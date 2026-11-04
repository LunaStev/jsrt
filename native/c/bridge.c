#define _POSIX_C_SOURCE 200809L
/* ABI glue only. JS execution and host behavior live in Wave. */
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include <pthread.h>
#include <spawn.h>
#include <signal.h>
#include <errno.h>
#include <unistd.h>
#include <time.h>

int64_t jsrt_spawn_actions_size(void) {
    return (int64_t)sizeof(posix_spawn_file_actions_t);
}

/* A broken child pipe is an I/O error, never a signal delivered to the host.
 * Consume only SIGPIPE introduced by this write and restore the caller's mask. */
int64_t jsrt_pipe_write(int fd, const void *bytes, int64_t count) {
    sigset_t blocked, previous, pending;
    sigemptyset(&blocked);
    sigaddset(&blocked, SIGPIPE);
    int error = pthread_sigmask(SIG_BLOCK, &blocked, &previous);
    if (error) {
        return -error;
    }
    if (sigpending(&pending)) {
        error = errno;
        pthread_sigmask(SIG_SETMASK, &previous, NULL);
        return -error;
    }
    bool already_pending = sigismember(&pending, SIGPIPE) == 1;
    ssize_t result = write(fd, bytes, (size_t)count);
    error = errno;
    if (result < 0 && error == EPIPE && !already_pending) {
        struct timespec now = {0, 0};
        while (sigtimedwait(&blocked, NULL, &now) < 0 && errno == EINTR) {
        }
    }
    pthread_sigmask(SIG_SETMASK, &previous, NULL);
    return result < 0 ? -error : result;
}
extern const void *jsrt_child_spawn(const void *, void *, void *, size_t, const void **,
                                    const void **);
extern const void *jsrt_child_kill(const void *, void *, void *, size_t, const void **,
                                   const void **);
void *jsrt_child_callback(int kind) {
    return kind ? (void *)jsrt_child_kill : (void *)jsrt_child_spawn;
}

extern void *jsrt_file_worker(void *);
void *(*jsrt_worker_callback(void))(void *) {
    return jsrt_file_worker;
}
int64_t jsrt_mutex_size(void) {
    return (int64_t)sizeof(pthread_mutex_t);
}
int64_t jsrt_condition_size(void) {
    return (int64_t)sizeof(pthread_cond_t);
}

typedef const void *JSValue;
extern void *jsrt_create_callable_constructor(void *, void *, void *);
extern JSValue jsrt_web_requires_new(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
void *jsrt_web_public_constructor(void *context, void *construct) {
    return jsrt_create_callable_constructor(context, (void *)jsrt_web_requires_new, construct);
}
extern void *jsrt_web_stream_construct(const void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_web_stream_method(const void *, void *, void *, size_t, const JSValue *,
                                      JSValue *);
void *jsrt_web_stream_callback(bool constructing) {
    return constructing ? (void *)jsrt_web_stream_construct : (void *)jsrt_web_stream_method;
}
extern void *jsrt_dom_construct(const void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_dom_method(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_dom_callback(bool constructing) {
    return constructing ? (void *)jsrt_dom_construct : (void *)jsrt_dom_method;
}
extern void *jsrt_text_construct(const void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_text_method(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_text_callback(bool constructing) {
    return constructing ? (void *)jsrt_text_construct : (void *)jsrt_text_method;
}
extern void *jsrt_form_construct(const void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_form_method(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_form_callback(bool constructing) {
    return constructing ? (void *)jsrt_form_construct : (void *)jsrt_form_method;
}
extern void *jsrt_web_construct(const void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_web_get(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_web_blob_read(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_web_copy(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_web_json(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_web_constructor(void) {
    return (void *)jsrt_web_construct;
}
void *jsrt_web_callback(int code) {
    if (code < 2) {
        return (void *)jsrt_web_get;
    }
    if (code < 5) {
        return (void *)jsrt_web_blob_read;
    }
    if (code < 7 || code == 8) {
        return (void *)jsrt_web_copy;
    }
    return (void *)jsrt_web_json;
}
extern void *jsrt_runtime_worker_task(void *);
void *jsrt_runtime_worker_callback(void) {
    return (void *)jsrt_runtime_worker_task;
}
extern JSValue jsrt_worker_construct(const void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_worker_post(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_worker_terminate(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
extern JSValue jsrt_worker_close(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_worker_call(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_worker_api_callback(int code) {
    switch (code) {
    case 0:
        return (void *)jsrt_worker_construct;
    case 1:
        return (void *)jsrt_worker_post;
    case 2:
        return (void *)jsrt_worker_terminate;
    case 3:
        return (void *)jsrt_worker_close;
    case 4:
        return (void *)jsrt_worker_call;
    default:
        return NULL;
    }
}
extern JSValue jsrt_structured_clone(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
void *jsrt_clone_callback(void) {
    return (void *)jsrt_structured_clone;
}
extern JSValue jsrt_headers_construct(const void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_headers_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_headers_callback(bool constructing) {
    return constructing ? (void *)jsrt_headers_construct : (void *)jsrt_headers_api;
}
extern void *jsrt_esm_resolve(void *, void *, void *, void **);
extern void *jsrt_esm_fetch(void *, void *, void **);
extern void *jsrt_esm_meta(void *, void *, void **);
extern void *jsrt_esm_value(void *, void *, int32_t, void **);
extern JSValue jsrt_esm_cjs(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_esm_fulfilled(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_esm_rejected(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_esm_callback(int kind) {
    if (kind == 0)
        return (void *)jsrt_esm_resolve;
    if (kind == 1)
        return (void *)jsrt_esm_fetch;
    if (kind == 2)
        return (void *)jsrt_esm_meta;
    if (kind == 5)
        return (void *)jsrt_esm_value;
    if (kind == 6)
        return (void *)jsrt_esm_cjs;
    return kind == 3 ? (void *)jsrt_esm_fulfilled : (void *)jsrt_esm_rejected;
}
extern JSValue jsrt_readdir(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_readdir_callback(void) {
    return (void *)jsrt_readdir;
}
extern JSValue jsrt_buffer_search(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_buffer_search_callback(void) {
    return (void *)jsrt_buffer_search;
}
extern JSValue jsrt_fs_sync(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_fs_sync_callback(void) {
    return (void *)jsrt_fs_sync;
}
extern JSValue jsrt_fs_more(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_fs_more_callback(void) {
    return (void *)jsrt_fs_more;
}
extern JSValue jsrt_fs_more_promise(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_fs_more_promise_callback(void) {
    return (void *)jsrt_fs_more_promise;
}
extern JSValue jsrt_buffer_numeric(const void *, void *, void *, size_t, const JSValue *,
                                   JSValue *);
void *jsrt_buffer_numeric_callback(void) {
    return (void *)jsrt_buffer_numeric;
}
typedef JSValue (*JSCallback)(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_handle_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_handle_complete(const void *, void *, void *, size_t, const JSValue *,
                                    JSValue *);
JSCallback jsrt_handle_callback(int32_t kind) {
    return kind == 1 ? jsrt_handle_complete : jsrt_handle_api;
}

extern JSValue jsrt_async_read(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_async_write(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_async_operation(const void *, void *, void *, size_t, const JSValue *,
                                    JSValue *);
JSCallback jsrt_async_callback(int32_t writing) {
    if (writing >= 2) {
        return jsrt_async_operation;
    }
    return writing ? jsrt_async_write : jsrt_async_read;
}

extern JSValue jsrt_require(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_resolve(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_run_main(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_module_callback(int32_t resolve_only) {
    switch (resolve_only) {
    case 0:
        return jsrt_require;
    case 1:
        return jsrt_resolve;
    case 2:
        return jsrt_run_main;
    default:
        return NULL;
    }
}

extern JSValue jsrt_console_log(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_console_error(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_set_timeout(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_set_interval(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_clear_timer(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_set_immediate(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_timer_method(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_queue_microtask(const void *, void *, void *, size_t, const JSValue *,
                                    JSValue *);
extern JSValue jsrt_run_microtask(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_unhandled_rejection(const void *, void *, void *, size_t, const JSValue *,
                                        JSValue *);
extern JSValue jsrt_json_parse(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_json_stringify(const void *, void *, void *, size_t, const JSValue *,
                                   JSValue *);
extern JSValue jsrt_cwd(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_read_file(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_write_file(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_exit_get(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_exit_set(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_chdir(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_system_callback(int32_t kind) {
    switch (kind) {
    case 0:
        return jsrt_cwd;
    case 1:
        return jsrt_read_file;
    case 2:
        return jsrt_write_file;
    case 3:
        return jsrt_exit_get;
    case 4:
        return jsrt_exit_set;
    case 5:
        return jsrt_chdir;
    default:
        return NULL;
    }
}
JSCallback jsrt_json_callback(int32_t kind) {
    return kind ? jsrt_json_stringify : jsrt_json_parse;
}
JSCallback jsrt_console_callback(int32_t error_output) {
    return error_output ? jsrt_console_error : jsrt_console_log;
}
JSCallback jsrt_timer_callback(int32_t kind) {
    switch (kind) {
    case 0:
        return jsrt_set_timeout;
    case 1:
        return jsrt_set_interval;
    case 2:
        return jsrt_clear_timer;
    case 3:
        return jsrt_queue_microtask;
    case 4:
        return jsrt_run_microtask;
    case 5:
        return jsrt_unhandled_rejection;
    case 6:
        return jsrt_set_immediate;
    case 7:
        return jsrt_timer_method;
    default:
        return NULL;
    }
}
int32_t jsrt_older_engine_allowed(void) {
#ifdef JSRT_ALLOW_OLDER_ENGINE
    return 1;
#else
    return 0;
#endif
}

/* Buffer callback address forwarding only. */
extern JSValue jsrt_buffer_from(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_buffer_alloc(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_buffer_is_buffer(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
extern JSValue jsrt_buffer_is_encoding(const void *, void *, void *, size_t, const JSValue *,
                                       JSValue *);
extern JSValue jsrt_buffer_byte_length(const void *, void *, void *, size_t, const JSValue *,
                                       JSValue *);
extern JSValue jsrt_buffer_concat(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_buffer_to_string(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
extern JSValue jsrt_buffer_subarray(const void *, void *, void *, size_t, const JSValue *,
                                    JSValue *);
extern JSValue jsrt_buffer_fill(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_buffer_copy(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_buffer_equals(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_buffer_compare(const void *, void *, void *, size_t, const JSValue *,
                                   JSValue *);
extern JSValue jsrt_buffer_to_json(const void *, void *, void *, size_t, const JSValue *,
                                   JSValue *);
extern JSValue jsrt_buffer_compare_static(const void *, void *, void *, size_t, const JSValue *,
                                          JSValue *);
extern JSValue jsrt_buffer_write(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_buffer_swap(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_buffer_callback(int32_t kind) {
    switch (kind) {
    case 0:
        return jsrt_buffer_from;
    case 1:
        return jsrt_buffer_alloc;
    case 2:
        return jsrt_buffer_is_buffer;
    case 3:
        return jsrt_buffer_is_encoding;
    case 4:
        return jsrt_buffer_byte_length;
    case 5:
        return jsrt_buffer_concat;
    case 6:
        return jsrt_buffer_to_string;
    case 7:
        return jsrt_buffer_subarray;
    case 8:
        return jsrt_buffer_fill;
    case 9:
        return jsrt_buffer_copy;
    case 10:
        return jsrt_buffer_equals;
    case 11:
        return jsrt_buffer_compare;
    case 12:
        return jsrt_buffer_to_json;
    case 13:
        return jsrt_buffer_compare_static;
    case 14:
        return jsrt_buffer_write;
    case 15:
        return jsrt_buffer_swap;
    default:
        return NULL;
    }
}
extern void *jsrt_buffer_construct(const void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_buffer_constructor_callback(void) {
    return (void *)jsrt_buffer_construct;
}

extern JSValue jsrt_event_on(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_emit(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_off(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_clear(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_inspect(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_once(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_settle_value(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_settle_error(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_static_count(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_event_max(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_event_callback(int32_t kind) {
    switch (kind) {
    case 0:
        return jsrt_event_on;
    case 1:
        return jsrt_event_emit;
    case 2:
        return jsrt_event_off;
    case 3:
        return jsrt_event_clear;
    case 4:
        return jsrt_event_inspect;
    case 5:
        return jsrt_event_once;
    case 6:
        return jsrt_event_settle_value;
    case 7:
        return jsrt_event_settle_error;
    case 8:
        return jsrt_event_static_count;
    case 9:
        return jsrt_event_max;
    default:
        return NULL;
    }
}
extern void *jsrt_event_construct(const void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_event_constructor_callback(void) {
    return (void *)jsrt_event_construct;
}
extern JSValue jsrt_stream_push(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_read(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_flow(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_write(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_end(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_destroy(const void *, void *, void *, size_t, const JSValue *,
                                   JSValue *);
extern JSValue jsrt_stream_pump_read(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
extern JSValue jsrt_stream_pump_write(const void *, void *, void *, size_t, const JSValue *,
                                      JSValue *);
extern JSValue jsrt_stream_done(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_complete(const void *, void *, void *, size_t, const JSValue *,
                                    JSValue *);
extern JSValue jsrt_stream_after_add(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
extern JSValue jsrt_stream_drain(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_pipe(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_close(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_get(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_hook_done(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
extern JSValue jsrt_transform_done(const void *, void *, void *, size_t, const JSValue *,
                                   JSValue *);
extern JSValue jsrt_stream_set_encoding(const void *, void *, void *, size_t, const JSValue *,
                                        JSValue *);
extern JSValue jsrt_stream_cork(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_stream_constructor_abort(const void *, void *, void *, size_t, const JSValue *,
                                             JSValue *);
extern JSValue jsrt_stream_has_instance(const void *, void *, void *, size_t, const JSValue *,
                                        JSValue *);
JSCallback jsrt_stream_callback(int32_t kind) {
    if (kind == 33) {
        return jsrt_stream_has_instance;
    }
    switch (kind) {
    case 0:
        return jsrt_stream_push;
    case 1:
        return jsrt_stream_read;
    case 2:
        return jsrt_stream_flow;
    case 3:
        return jsrt_stream_flow;
    case 4:
        return jsrt_stream_write;
    case 5:
        return jsrt_stream_end;
    case 6:
        return jsrt_stream_destroy;
    case 7:
        return jsrt_stream_pipe;
    case 8:
        return jsrt_stream_pipe;
    case 9:
        return jsrt_stream_pump_read;
    case 10:
        return jsrt_stream_pump_write;
    case 11:
        return jsrt_stream_done;
    case 12:
        return jsrt_stream_complete;
    case 13:
        return jsrt_stream_after_add;
    case 14:
        return jsrt_stream_drain;
    case 15:
        return jsrt_stream_close;
    case 16:
        return jsrt_stream_get;
    case 17:
        return jsrt_stream_get;
    case 18:
        return jsrt_stream_get;
    case 19:
        return jsrt_stream_get;
    case 20:
        return jsrt_stream_get;
    case 21:
        return jsrt_stream_get;
    case 22:
        return jsrt_stream_get;
    case 23:
        return jsrt_stream_hook_done;
    case 24:
        return jsrt_stream_hook_done;
    case 25:
    case 26:
        return jsrt_transform_done;
    case 27:
        return jsrt_stream_set_encoding;
    case 28:
    case 31:
        return jsrt_stream_get;
    case 29:
    case 30:
        return jsrt_stream_cork;
    case 32:
        return jsrt_stream_constructor_abort;
    default:
        return NULL;
    }
}
extern void *jsrt_stream_construct(const void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_stream_constructor_callback(void) {
    return (void *)jsrt_stream_construct;
}
extern JSValue jsrt_file_stream_create(const void *, void *, void *, size_t, const JSValue *,
                                       JSValue *);
extern JSValue jsrt_file_stream_hook(const void *, void *, void *, size_t, const JSValue *,
                                     JSValue *);
extern JSValue jsrt_file_stream_complete(const void *, void *, void *, size_t, const JSValue *,
                                         JSValue *);
JSCallback jsrt_file_stream_callback(int32_t kind) {
    if (kind < 2)
        return jsrt_file_stream_create;
    if (kind == 6)
        return jsrt_file_stream_complete;
    return jsrt_file_stream_hook;
}
extern JSValue jsrt_stream_watch(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_pipeline_member(const void *, void *, void *, size_t, const JSValue *,
                                    JSValue *);
extern JSValue jsrt_stream_promise_result(const void *, void *, void *, size_t, const JSValue *,
                                          JSValue *);
extern JSValue jsrt_stream_util_api(const void *, void *, void *, size_t, const JSValue *,
                                    JSValue *);
extern JSValue jsrt_stream_abort(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_stream_util_callback(int32_t kind) {
    if (kind == 15)
        return jsrt_stream_watch;
    if (kind >= 12)
        return jsrt_stream_abort;
    if (kind < 6)
        return jsrt_stream_watch;
    if (kind == 6)
        return jsrt_pipeline_member;
    if (kind == 7)
        return jsrt_stream_promise_result;
    return jsrt_stream_util_api;
}
extern JSValue jsrt_body_event(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_body_consume(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_body_callback(int32_t kind) {
    return kind < 4 ? jsrt_body_event : jsrt_body_consume;
}
/* Cancellation callback ABI only; policy stays in Wave. */
extern const void *jsrt_abort_api(const void *, void *, void *, size_t, const void **,
                                  const void **);
extern void *jsrt_abort_construct(const void *, void *, size_t, const void **, const void **);
void *jsrt_abort_callback(int kind) {
    return kind == 10 ? (void *)jsrt_abort_construct : (void *)jsrt_abort_api;
}
extern JSValue jsrt_path_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_path_callback(void) {
    return jsrt_path_api;
}
extern JSValue jsrt_os_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_os_callback(void) {
    return jsrt_os_api;
}
extern JSValue jsrt_util_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_util_callback(void) {
    return jsrt_util_api;
}
extern JSValue jsrt_util_type_check(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_util_type_callback(void) {
    return jsrt_util_type_check;
}
extern JSValue jsrt_extras_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_util_text_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_util_text_callback(void) {
    return jsrt_util_text_api;
}
extern JSValue jsrt_process_warning_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_process_warning_callback(void) {
    return jsrt_process_warning_api;
}
extern JSValue jsrt_url_file_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_url_file_callback(void) {
    return jsrt_url_file_api;
}
extern JSValue jsrt_util_args_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_util_args_callback(void) {
    return jsrt_util_args_api;
}
extern JSValue jsrt_events_on_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_events_on_callback(void) {
    return jsrt_events_on_api;
}
extern void *jsrt_string_decoder_construct(const void *, void *, size_t, const JSValue *, JSValue *);
extern JSValue jsrt_string_decoder_method(const void *, void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_string_decoder_callback(bool constructing) {
    return constructing ? (void *)jsrt_string_decoder_construct : (void *)jsrt_string_decoder_method;
}
JSCallback jsrt_extras_callback(void) {
    return jsrt_extras_api;
}
extern JSValue jsrt_callbacks_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_callbacks_callback(void) {
    return jsrt_callbacks_api;
}
extern JSValue jsrt_timers_promises_api(const void *, void *, void *, size_t, const JSValue *,
                                         JSValue *);
JSCallback jsrt_timers_promises_callback(void) {
    return jsrt_timers_promises_api;
}
extern JSValue jsrt_assert_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern void *jsrt_assert_construct(const void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_assert_ctor_callback(void) {
    return (void *)jsrt_assert_construct;
}
JSCallback jsrt_assert_callback(void) {
    return jsrt_assert_api;
}
extern JSValue jsrt_crypto_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_crypto_callback(void) {
    return jsrt_crypto_api;
}
extern JSValue jsrt_crypto_hashes(const void *, void *, void *, size_t, const JSValue *, JSValue *);
JSCallback jsrt_crypto_hashes_callback(void) {
    return jsrt_crypto_hashes;
}
extern void jsrt_crypto_finalize(void *, void *);
void *jsrt_crypto_deallocator(void) {
    return (void *)jsrt_crypto_finalize;
}
extern JSValue jsrt_params_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern void *jsrt_params_construct(const void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_params_callback(int32_t kind) {
    return kind == 15 ? (void *)jsrt_params_construct : (void *)jsrt_params_api;
}
extern JSValue jsrt_url_api(const void *, void *, void *, size_t, const JSValue *, JSValue *);
extern void *jsrt_url_construct(const void *, void *, size_t, const JSValue *, JSValue *);
void *jsrt_url_callback(int32_t kind) {
    return kind == 26 ? (void *)jsrt_url_construct : (void *)jsrt_url_api;
}
extern size_t jsrt_package_download(void *, size_t, size_t, void *);
void *jsrt_package_download_callback(void) {
    return (void *)jsrt_package_download;
}
