/* Implemented Node-API ABI subset. This is not the complete Node.js SDK. */
#ifndef JSRT_NODE_API_H
#define JSRT_NODE_API_H
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct napi_env__ *napi_env;
typedef void *napi_value;
typedef struct napi_callback_info__ *napi_callback_info;
typedef struct napi_handle_scope__ *napi_handle_scope;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);
typedef enum {
    napi_ok,
    napi_invalid_arg,
    napi_object_expected,
    napi_string_expected,
    napi_name_expected,
    napi_function_expected,
    napi_number_expected,
    napi_boolean_expected,
    napi_array_expected,
    napi_generic_failure,
    napi_pending_exception,
    napi_cancelled,
    napi_escape_called_twice,
    napi_handle_scope_mismatch
} napi_status;
typedef enum {
    napi_undefined,
    napi_null,
    napi_boolean,
    napi_number,
    napi_string,
    napi_symbol,
    napi_object,
    napi_function,
    napi_external,
    napi_bigint
} napi_valuetype;
typedef enum {
    napi_default = 0,
    napi_writable = 1,
    napi_enumerable = 2,
    napi_configurable = 4,
    napi_static = 1024
} napi_property_attributes;
typedef struct {
    const char *utf8name;
    napi_value name;
    napi_callback method, getter, setter;
    napi_value value;
    napi_property_attributes attributes;
    void *data;
} napi_property_descriptor;
typedef struct {
    const char *error_message;
    void *engine_reserved;
    uint32_t engine_error_code;
    napi_status error_code;
} napi_extended_error_info;
#define NAPI_AUTO_LENGTH ((size_t)-1)
napi_status napi_get_version(napi_env, uint32_t *);
napi_status napi_get_last_error_info(napi_env, const napi_extended_error_info **);
napi_status napi_get_undefined(napi_env, napi_value *);
napi_status napi_get_null(napi_env, napi_value *);
napi_status napi_get_global(napi_env, napi_value *);
napi_status napi_get_boolean(napi_env, bool, napi_value *);
napi_status napi_create_double(napi_env, double, napi_value *);
napi_status napi_create_int32(napi_env, int32_t, napi_value *);
napi_status napi_create_uint32(napi_env, uint32_t, napi_value *);
napi_status napi_create_int64(napi_env, int64_t, napi_value *);
napi_status napi_get_value_double(napi_env, napi_value, double *);
napi_status napi_get_value_int32(napi_env, napi_value, int32_t *);
napi_status napi_get_value_uint32(napi_env, napi_value, uint32_t *);
napi_status napi_get_value_int64(napi_env, napi_value, int64_t *);
napi_status napi_get_value_bool(napi_env, napi_value, bool *);
napi_status napi_typeof(napi_env, napi_value, napi_valuetype *);
napi_status napi_strict_equals(napi_env, napi_value, napi_value, bool *);
napi_status napi_create_string_utf8(napi_env, const char *, size_t, napi_value *);
napi_status napi_create_string_latin1(napi_env, const char *, size_t, napi_value *);
napi_status napi_create_string_utf16(napi_env, const uint16_t *, size_t, napi_value *);
napi_status napi_get_value_string_utf8(napi_env, napi_value, char *, size_t, size_t *);
napi_status napi_get_value_string_utf16(napi_env, napi_value, uint16_t *, size_t, size_t *);
napi_status napi_create_object(napi_env, napi_value *);
napi_status napi_create_array(napi_env, napi_value *);
napi_status napi_create_array_with_length(napi_env, size_t, napi_value *);
napi_status napi_is_array(napi_env, napi_value, bool *);
napi_status napi_get_array_length(napi_env, napi_value, uint32_t *);
napi_status napi_get_named_property(napi_env, napi_value, const char *, napi_value *);
napi_status napi_set_named_property(napi_env, napi_value, const char *, napi_value);
napi_status napi_has_named_property(napi_env, napi_value, const char *, bool *);
napi_status napi_get_element(napi_env, napi_value, uint32_t, napi_value *);
napi_status napi_set_element(napi_env, napi_value, uint32_t, napi_value);
napi_status napi_create_function(napi_env, const char *, size_t, napi_callback, void *,
                                 napi_value *);
napi_status napi_get_cb_info(napi_env, napi_callback_info, size_t *, napi_value *, napi_value *,
                             void **);
napi_status napi_get_new_target(napi_env, napi_callback_info, napi_value *);
napi_status napi_call_function(napi_env, napi_value, napi_value, size_t, const napi_value *,
                               napi_value *);
napi_status napi_define_properties(napi_env, napi_value, size_t, const napi_property_descriptor *);
napi_status napi_create_error(napi_env, napi_value, napi_value, napi_value *);
napi_status napi_create_type_error(napi_env, napi_value, napi_value, napi_value *);
napi_status napi_create_range_error(napi_env, napi_value, napi_value, napi_value *);
napi_status napi_throw(napi_env, napi_value);
napi_status napi_throw_error(napi_env, const char *, const char *);
napi_status napi_throw_type_error(napi_env, const char *, const char *);
napi_status napi_throw_range_error(napi_env, const char *, const char *);
napi_status napi_is_exception_pending(napi_env, bool *);
napi_status napi_get_and_clear_last_exception(napi_env, napi_value *);
napi_status napi_open_handle_scope(napi_env, napi_handle_scope *);
napi_status napi_close_handle_scope(napi_env, napi_handle_scope);
#ifdef __cplusplus
}
#endif
#endif
