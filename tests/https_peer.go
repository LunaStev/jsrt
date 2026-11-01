// Independent TLS protocol peer for JSC/Wave regression tests.
// The Wave harness builds, starts, stops and removes this isolated helper.
package main

import (
    "crypto/tls"
    "flag"
    "fmt"
    "io"
    "net/http"
    "os"
    "strings"
    "time"
)

const maxBodyBytes = 8 * 1024 * 1024

func main() {
    listen := flag.String("listen", "127.0.0.1:0", "loopback address")
    cert := flag.String("cert", "", "test certificate")
    key := flag.String("key", "", "test private key")
    flag.Parse()

    server := &http.Server{
        Addr:              *listen,
        ReadHeaderTimeout: 5 * time.Second,
        IdleTimeout:       5 * time.Second,
        TLSConfig:         &tls.Config{MinVersion: tls.VersionTLS12},
        TLSNextProto:      make(map[string]func(*http.Server, *tls.Conn, http.Handler)),
    }
    server.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer r.Body.Close()
        switch r.URL.Path {
        case "/echo", "/slow":
            reader := http.MaxBytesReader(w, r.Body, maxBodyBytes)
            var body []byte
            var err error
            if r.URL.Path == "/slow" {
                chunk := make([]byte, 1024)
                for {
                    n, readErr := reader.Read(chunk)
                    body = append(body, chunk[:n]...)
                    if readErr != nil {
                        if readErr != io.EOF {
                            err = readErr
                        }
                        break
                    }
                    time.Sleep(time.Millisecond)
                }
            } else {
                body, err = io.ReadAll(reader)
            }
            if err != nil {
                http.Error(w, "invalid upload", http.StatusBadRequest)
                return
            }
            w.Header().Set("X-Upload-Type", r.Header.Get("Content-Type"))
            _, _ = w.Write(body)
        case "/stall-response":
            _, _ = io.WriteString(w, "ready")
            w.(http.Flusher).Flush()
            <-r.Context().Done()
        case "/downgrade":
            w.Header().Set("Location", "http://"+r.Host+"/")
            w.WriteHeader(http.StatusFound)
        case "/oversized-headers":
            w.Header().Set("X-Oversized", strings.Repeat("a", 20000))
            _, _ = io.WriteString(w, "oversized")
        default:
            _, _ = io.WriteString(w, "TLS peer ready")
        }
    })
    if err := server.ListenAndServeTLS(*cert, *key); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}
