/* llhttp layout/callback ABI only. Request policy and storage belong to Wave. */
#include <stdint.h>
#include "llhttp.h"

extern int32_t jsrt_http_span(void *, int32_t, const char *, int64_t);
extern int32_t jsrt_http_headers(void *, int32_t, int32_t, int32_t);
extern int32_t jsrt_http_complete(void *);

#define SPAN(name, kind)                                                                           \
    static int name(llhttp_t *p, const char *s, size_t n) {                                        \
        return jsrt_http_span(p->data, kind, s, (int64_t)n);                                       \
    }
SPAN(on_url, 0)
SPAN(on_field, 1)
SPAN(on_value, 2)
SPAN(on_body, 3)
static int on_field_done(llhttp_t *p) {
    return jsrt_http_span(p->data, 4, NULL, 0);
}
static int on_value_done(llhttp_t *p) {
    return jsrt_http_span(p->data, 5, NULL, 0);
}
static int on_headers(llhttp_t *p) {
    return jsrt_http_headers(p->data, p->upgrade, p->http_major, p->http_minor);
}
static int on_complete(llhttp_t *p) {
    return jsrt_http_complete(p->data) ? HPE_USER : HPE_PAUSED;
}
int64_t jsrt_http_parser_size(void) {
    return sizeof(llhttp_t);
}
int64_t jsrt_http_settings_size(void) {
    return sizeof(llhttp_settings_t);
}
void jsrt_http_parser_init(llhttp_t *p, llhttp_settings_t *s, void *data) {
    llhttp_settings_init(s);
    s->on_url = on_url;
    s->on_header_field = on_field;
    s->on_header_value = on_value;
    s->on_header_field_complete = on_field_done;
    s->on_header_value_complete = on_value_done;
    s->on_headers_complete = on_headers;
    s->on_body = on_body;
    s->on_message_complete = on_complete;
    llhttp_init(p, HTTP_REQUEST, s);
    p->data = data;
}
int32_t jsrt_http_paused_code(void) {
    return HPE_PAUSED;
}
#define STRINGIFY_INNER(n) #n
#define STRINGIFY(n) STRINGIFY_INNER(n)
const char *jsrt_http_parser_version(void) {
    return STRINGIFY(LLHTTP_VERSION_MAJOR) "." STRINGIFY(LLHTTP_VERSION_MINOR) "." STRINGIFY(
        LLHTTP_VERSION_PATCH);
}
