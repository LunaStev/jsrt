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
    "sync/atomic"
    "time"
)

const maxBodyBytes = 8 * 1024 * 1024

// Upload counters let the client prove that an abort reached the transport.
// received counts body bytes read by /hold-upload; aborted counts uploads whose
// body ended with a transport error instead of a clean EOF.
var receivedBytes int64
var abortedUploads int64

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
        case "/hold-upload":
            // Reads slowly and never replies, so the request stays in flight until
            // the client aborts or the safety deadline passes.
            chunk := make([]byte, 4096)
            deadline := time.Now().Add(15 * time.Second)
            for time.Now().Before(deadline) {
                n, readErr := r.Body.Read(chunk)
                atomic.AddInt64(&receivedBytes, int64(n))
                if readErr == io.EOF {
                    _, _ = io.WriteString(w, "complete")
                    return
                }
                if readErr != nil {
                    atomic.AddInt64(&abortedUploads, 1)
                    return
                }
                time.Sleep(time.Millisecond)
            }
        case "/stats":
            fmt.Fprintf(w, "%d %d", atomic.LoadInt64(&receivedBytes), atomic.LoadInt64(&abortedUploads))
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
