/* Permanent native ABI regression input; generated .node files are temporary. */
#include "../native/include/jsrt_node_api.h"
#include <stdlib.h>
#include <pthread.h>
#ifndef JSRT_ADDON_MODE
#define JSRT_ADDON_MODE 0
#endif
#if JSRT_ADDON_MODE == 3
int this_is_not_a_node_api_addon(void) {
    return 1;
}
#else
int32_t node_api_module_get_api_version_v1(void) {
    return JSRT_ADDON_MODE == 1 ? 99 : 1;
}
#if JSRT_ADDON_MODE == 0 || JSRT_ADDON_MODE == 2
#define CHECK(call)                                                                                \
    do {                                                                                           \
        if ((call) != napi_ok)                                                                     \
            return NULL;                                                                           \
    } while (0)
static napi_value add(napi_env env, napi_callback_info info) {
    size_t count = 2;
    napi_value args[2], out;
    double a, b;
    CHECK(napi_get_cb_info(env, info, &count, args, NULL, NULL));
    if (count != 2 || napi_get_value_double(env, args[0], &a) != napi_ok ||
        napi_get_value_double(env, args[1], &b) != napi_ok) {
        napi_throw_type_error(env, "ERR_NATIVE_ARGUMENT", "expected two numbers");
        return NULL;
    }
    CHECK(napi_create_double(env, a + b, &out));
    return out;
}
static napi_value echo(napi_env env, napi_callback_info info) {
    size_t count = 1, length = 0;
    napi_value value, out;
    CHECK(napi_get_cb_info(env, info, &count, &value, NULL, NULL));
    CHECK(napi_get_value_string_utf8(env, value, NULL, 0, &length));
    char *bytes = malloc(length + 1);
    if (!bytes)
        return NULL;
    napi_status read = napi_get_value_string_utf8(env, value, bytes, length + 1, &length);
    napi_status create = read == napi_ok ? napi_create_string_utf8(env, bytes, length, &out) : read;
    free(bytes);
    return create == napi_ok ? out : NULL;
}
static napi_value invoke(napi_env env, napi_callback_info info) {
    size_t count = 3;
    napi_value args[3], out;
    CHECK(napi_get_cb_info(env, info, &count, args, NULL, NULL));
    if (count != 3)
        return NULL;
    CHECK(napi_call_function(env, args[1], args[0], 1, &args[2], &out));
    return out;
}
static napi_value read_value(napi_env env, napi_callback_info info) {
    size_t count = 1;
    napi_value value, out;
    CHECK(napi_get_cb_info(env, info, &count, &value, NULL, NULL));
    CHECK(napi_get_named_property(env, value, "value", &out));
    return out;
}
static napi_value has_value(napi_env env, napi_callback_info info) {
    size_t count = 1;
    napi_value value, out;
    bool has = false;
    CHECK(napi_get_cb_info(env, info, &count, &value, NULL, NULL));
    CHECK(napi_has_named_property(env, value, "value", &has));
    CHECK(napi_get_boolean(env, has, &out));
    return out;
}
static napi_value is_array(napi_env env, napi_callback_info info) {
    size_t count = 1;
    napi_value value, out;
    bool array = false;
    CHECK(napi_get_cb_info(env, info, &count, &value, NULL, NULL));
    CHECK(napi_is_array(env, value, &array));
    CHECK(napi_get_boolean(env, array, &out));
    return out;
}
static napi_value clear_exception(napi_env env, napi_callback_info info) {
    size_t count = 1;
    napi_value function, receiver, out;
    bool pending = false;
    CHECK(napi_get_cb_info(env, info, &count, &function, NULL, NULL));
    CHECK(napi_get_undefined(env, &receiver));
    if (napi_call_function(env, receiver, function, 0, NULL, &out) != napi_pending_exception)
        return NULL;
    CHECK(napi_is_exception_pending(env, &pending));
    if (!pending)
        return NULL;
    CHECK(napi_get_and_clear_last_exception(env, &out));
    return out;
}
static napi_value scopes(napi_env env, napi_callback_info info) {
    (void)info;
    for (int i = 0; i < 70000; ++i) {
        napi_handle_scope scope;
        napi_value value;
        CHECK(napi_open_handle_scope(env, &scope));
        CHECK(napi_create_int32(env, i, &value));
        CHECK(napi_close_handle_scope(env, scope));
    }
    napi_value out;
    CHECK(napi_create_int32(env, 70000, &out));
    return out;
}
static napi_value integer(napi_env env, napi_callback_info info) {
    size_t count = 1;
    napi_value value, out;
    int32_t integer;
    CHECK(napi_get_cb_info(env, info, &count, &value, NULL, NULL));
    CHECK(napi_get_value_int32(env, value, &integer));
    CHECK(napi_create_int32(env, integer, &out));
    return out;
}
static napi_value data(napi_env env, napi_callback_info info) {
    void *user = NULL;
    napi_value out;
    size_t count;
    CHECK(napi_get_cb_info(env, info, &count, NULL, NULL, &user));
    CHECK(napi_create_int32(env, *(int *)user, &out));
    return out;
}
static napi_value getter(napi_env env, napi_callback_info info) {
    (void)info;
    napi_value out;
    CHECK(napi_create_int32(env, 42, &out));
    return out;
}
static int callback_data = 41;
struct thread_probe {
    napi_env env;
    napi_status status;
};
static void *probe_thread(void *argument) {
    struct thread_probe *probe = argument;
    uint32_t version = 0;
    probe->status = napi_get_version(probe->env, &version);
    return NULL;
}
static napi_value wrong_thread(napi_env env, napi_callback_info info) {
    (void)info;
    struct thread_probe probe = {env, napi_ok};
    pthread_t thread;
    napi_value out;
    if (pthread_create(&thread, NULL, probe_thread, &probe) || pthread_join(thread, NULL))
        return NULL;
    CHECK(napi_create_int32(env, probe.status, &out));
    return out;
}
#endif
#if JSRT_ADDON_MODE == 4
extern napi_status napi_create_external(napi_env, void *, void *, void *, napi_value *);
#endif
napi_value napi_register_module_v1(napi_env env, napi_value exports) {
#if JSRT_ADDON_MODE == 1
    (void)env;
    return exports;
#elif JSRT_ADDON_MODE == 4
    napi_value value;
    napi_create_external(env, NULL, NULL, NULL, &value);
    return exports;
#else
    napi_property_descriptor properties[] = {
        {"add", NULL, add, NULL, NULL, NULL, napi_default, NULL},
        {"echo", NULL, echo, NULL, NULL, NULL, napi_default, NULL},
        {"invoke", NULL, invoke, NULL, NULL, NULL, napi_default, NULL},
        {"read", NULL, read_value, NULL, NULL, NULL, napi_default, NULL},
        {"has", NULL, has_value, NULL, NULL, NULL, napi_default, NULL},
        {"isArray", NULL, is_array, NULL, NULL, NULL, napi_default, NULL},
        {"clearException", NULL, clear_exception, NULL, NULL, NULL, napi_default, NULL},
        {"scopes", NULL, scopes, NULL, NULL, NULL, napi_default, NULL},
        {"integer", NULL, integer, NULL, NULL, NULL, napi_default, NULL},
        {"data", NULL, data, NULL, NULL, NULL, napi_default, &callback_data},
        {"wrongThread", NULL, wrong_thread, NULL, NULL, NULL, napi_default, NULL},
        {"answer", NULL, NULL, getter, NULL, NULL, napi_enumerable, NULL}};
    CHECK(napi_define_properties(env, exports, sizeof(properties) / sizeof(properties[0]),
                                 properties));
#if JSRT_ADDON_MODE == 2
    napi_value global;
    CHECK(napi_get_global(env, &global));
    CHECK(napi_set_named_property(env, global, "escapedNative", exports));
    napi_throw_error(env, "ERR_NATIVE_INIT", "native initialization failed");
#endif
    return exports;
#endif
}
#endif
