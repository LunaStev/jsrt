/* libuv struct and callback ABI only. Handle policy/storage live in Wave. */
#include <stdint.h>
#include "uv.h"

extern void jsrt_net_connection(void *, int32_t);
extern void jsrt_net_allocate(void *, int64_t, void **, int64_t *);
extern void jsrt_net_read(void *, int64_t, void *);
extern void jsrt_net_written(void *, int32_t);
extern void jsrt_net_closed(void *);
extern void jsrt_signal_ready(void *);
extern void jsrt_signal_closed(void *);

static void signal_received(uv_signal_t *handle, int signum) {
    (void)signum;
    jsrt_signal_ready(handle);
}
static void signal_closed(uv_handle_t *handle) {
    jsrt_signal_closed(handle);
}
int64_t jsrt_uv_signal_size(void) {
    return sizeof(uv_signal_t);
}
int32_t jsrt_uv_signal_start(uv_loop_t *loop, uv_signal_t *handle, void *data, int32_t signum) {
    (void)loop;
    handle->data = data;
    uv_unref((uv_handle_t *)handle);
    return uv_signal_start(handle, signal_received, signum);
}
void jsrt_uv_signal_stop(uv_signal_t *handle) {
    uv_signal_stop(handle);
    uv_close((uv_handle_t *)handle, signal_closed);
}

static void connected(uv_stream_t *s, int status) {
    jsrt_net_connection(s, status);
}
static void allocated(uv_handle_t *h, size_t n, uv_buf_t *b) {
    void *bytes = NULL;
    int64_t size = 0;
    jsrt_net_allocate(h, (int64_t)n, &bytes, &size);
    b->base = bytes;
    b->len = (size_t)size;
}
static void received(uv_stream_t *s, ssize_t n, const uv_buf_t *b) {
    jsrt_net_read(s, n, b->base);
}
static void written(uv_write_t *r, int status) {
    jsrt_net_written(r, status);
}
static void closed(uv_handle_t *h) {
    jsrt_net_closed(h);
}
int64_t jsrt_uv_tcp_size(void) {
    return sizeof(uv_tcp_t);
}
int64_t jsrt_uv_write_size(void) {
    return sizeof(uv_write_t);
}
int jsrt_uv_listen(uv_tcp_t *s, int backlog) {
    return uv_listen((uv_stream_t *)s, backlog, connected);
}
int jsrt_uv_read_start(uv_tcp_t *s) {
    return uv_read_start((uv_stream_t *)s, allocated, received);
}
int jsrt_uv_write(uv_write_t *r, uv_tcp_t *s, void *bytes, int64_t size) {
    uv_buf_t b = uv_buf_init(bytes, (unsigned int)size);
    return uv_write(r, (uv_stream_t *)s, &b, 1, written);
}
void jsrt_uv_close(uv_handle_t *h) {
    uv_close(h, closed);
}
int jsrt_uv_address(uv_tcp_t *s, char *host, size_t capacity, int32_t *port, int32_t *family) {
    struct sockaddr_storage address;
    int size = sizeof(address);
    int result = uv_tcp_getsockname(s, (struct sockaddr *)&address, &size);
    if (result < 0)
        return result;
    if (address.ss_family == AF_INET6) {
        struct sockaddr_in6 *a = (struct sockaddr_in6 *)&address;
        *family = 6;
        *port = ntohs(a->sin6_port);
        return uv_ip6_name(a, host, capacity);
    }
    struct sockaddr_in *a = (struct sockaddr_in *)&address;
    *family = 4;
    *port = ntohs(a->sin_port);
    return uv_ip4_name(a, host, capacity);
}
int jsrt_uv_bind(uv_tcp_t *s, const char *host, int port, int family) {
    if (family == 6) {
        struct sockaddr_in6 address;
        int result = uv_ip6_addr(host, port, &address);
        return result < 0 ? result : uv_tcp_bind(s, (struct sockaddr *)&address, 0);
    }
    struct sockaddr_in address;
    int result = uv_ip4_addr(host, port, &address);
    return result < 0 ? result : uv_tcp_bind(s, (struct sockaddr *)&address, 0);
}

typedef const void *Value;
typedef Value (*Callback)(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_create(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_listen(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_address(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_close(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_end(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_set_header(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_stream_write(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_stream_final(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_stream_destroy(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_stream_read(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_write(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_close_all(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_get_header(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_has_header(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_get_headers(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_remove_header(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_http_write_head(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_query_parse(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_query_stringify(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_process_signal_add(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_process_stdio_write(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_process_io_read(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_process_io_destroy(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_process_io_write(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_process_io_final(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_process_next_tick(const void *, void *, void *, size_t, const Value *, Value *);
Callback jsrt_http_callback(int32_t kind) {
    switch (kind) {
    case 0:
        return jsrt_http_create;
    case 1:
        return jsrt_http_listen;
    case 2:
        return jsrt_http_address;
    case 3:
        return jsrt_http_close;
    case 4:
        return jsrt_http_end;
    case 5:
        return jsrt_http_set_header;
    case 6:
        return jsrt_http_stream_write;
    case 7:
        return jsrt_http_stream_final;
    case 8:
        return jsrt_http_stream_destroy;
    case 9:
        return jsrt_http_write;
    case 10:
        return jsrt_http_stream_read;
    case 11:
        return jsrt_http_close_all;
    case 12:
        return jsrt_http_get_header;
    case 13:
        return jsrt_http_has_header;
    case 14:
        return jsrt_http_get_headers;
    case 15:
        return jsrt_http_remove_header;
    case 16:
        return jsrt_http_write_head;
    case 17:
        return jsrt_query_parse;
    case 18:
        return jsrt_process_signal_add;
    case 19:
        return jsrt_process_stdio_write;
    case 20:
        return jsrt_process_io_read;
    case 21:
        return jsrt_process_io_destroy;
    case 22:
        return jsrt_process_io_write;
    case 23:
        return jsrt_process_io_final;
    case 24:
        return jsrt_process_next_tick;
    case 25:
        return jsrt_query_stringify;
    default:
        return NULL;
    }
}
