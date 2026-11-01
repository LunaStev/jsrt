/* Stable libcurl variadic/function-pointer/structure ABI adaptation only. */
#include <stdint.h>
#include <stddef.h>
extern int curl_easy_setopt(void *, int, ...);
extern int curl_easy_getinfo(void *, int, ...);
extern void *curl_multi_info_read(void *, int *);
extern int curl_multi_poll(void *, void *, unsigned, int, int *);
int jsrt_curl_set_long(void *h, int key, int64_t value) {
    return curl_easy_setopt(h, key, (long)value);
}
int jsrt_curl_set_ptr(void *h, int key, void *value) {
    return curl_easy_setopt(h, key, value);
}
int64_t jsrt_curl_get_long(void *h, int key) {
    long value = 0;
    return curl_easy_getinfo(h, key, &value) ? -1 : value;
}
void *jsrt_curl_get_ptr(void *h, int key) {
    void *value = NULL;
    return curl_easy_getinfo(h, key, &value) ? NULL : value;
}
struct Message {
    int msg;
    void *easy;
    union {
        void *value;
        int result;
    } data;
};
void *jsrt_curl_message(void *m, int32_t *result) {
    int remaining;
    struct Message *message;
    while ((message = curl_multi_info_read(m, &remaining))) {
        if (message->msg == 1) {
            *result = message->data.result;
            return message->easy;
        }
    }
    return NULL;
}
struct WaitFd {
    int fd;
    short events, revents;
};
int jsrt_curl_poll(void *m, int fd1, int fd2, int timeout) {
    struct WaitFd descriptors[2];
    unsigned count = 0;
    if (fd1 >= 0)
        descriptors[count++] = (struct WaitFd){fd1, 1, 0};
    if (fd2 >= 0)
        descriptors[count++] = (struct WaitFd){fd2, 1, 0};
    return curl_multi_poll(m, descriptors, count, timeout, NULL);
}
extern size_t jsrt_curl_body(char *, size_t, size_t, void *);
extern size_t jsrt_curl_header(char *, size_t, size_t, void *);
extern size_t jsrt_curl_upload(char *, size_t, size_t, void *);
void *jsrt_curl_native_callback(int kind) {
    if (kind == 2)
        return (void *)jsrt_curl_upload;
    return kind ? (void *)jsrt_curl_header : (void *)jsrt_curl_body;
}
struct Version {
    int age;
    const char *version;
    unsigned version_num;
    const char *host;
    int features;
};
extern const struct Version *curl_version_info(int);
int jsrt_curl_features(void) {
    return curl_version_info(0)->features;
}
unsigned jsrt_curl_version_number(void) {
    return curl_version_info(0)->version_num;
}
typedef const void *Value;
typedef Value (*Callback)(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_client_api(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_client_hook(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_client_header_get(const void *, void *, void *, size_t, const Value *, Value *);
extern Value jsrt_client_abort(const void *, void *, void *, size_t, const Value *, Value *);
Callback jsrt_client_callback(int kind) {
    if (kind == 11 || kind == 12)
        return jsrt_client_abort;
    if (kind < 5)
        return jsrt_client_api;
    if (kind == 8 || kind == 9)
        return jsrt_client_header_get;
    return jsrt_client_hook;
}
