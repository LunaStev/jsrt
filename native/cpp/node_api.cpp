// Node-API C ABI adapter over the existing JSC C bridge. No JS parser or host loop.
#include "../include/jsrt_node_api.h"
#include "../c/engine.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <dlfcn.h>
#include <limits>
#include <memory>
#include <string>
#include <thread>
#include <vector>

struct napi_handle_scope__ {
    size_t mark;
};
struct NativeFunction {
    void *function;
    napi_callback callback;
    void *data;
};
struct napi_env__ {
    void *ctx;
    std::thread::id owner = std::this_thread::get_id();
    bool stopping = false;
    size_t max_modules, max_functions, max_handles, max_string;
    void *pending = nullptr, *define = nullptr, *has = nullptr, *apply = nullptr,
         *is_array = nullptr;
    void *errors[3] = {};
    std::vector<void *> roots, libraries;
    std::vector<NativeFunction> functions;
    std::vector<napi_handle_scope> scopes;
    napi_extended_error_info error = {nullptr, nullptr, 0, napi_ok};
};
struct napi_callback_info__ {
    napi_env env;
    size_t argc;
    void **argv;
    void *receiver;
    void *data;
};
static thread_local std::vector<std::unique_ptr<napi_env__>> environments;
static napi_env find_env(void *ctx) {
    for (auto &env : environments)
        if (env->ctx == ctx)
            return env.get();
    return nullptr;
}
static bool valid(napi_env env) {
    return env && env->owner == std::this_thread::get_id() && !env->stopping;
}
static napi_status status(napi_env env, napi_status code) {
    if (env)
        env->error = {code == napi_ok ? nullptr : "Node-API operation failed", nullptr, 0, code};
    return code;
}
static napi_status ready(napi_env env) {
    if (!valid(env))
        return napi_invalid_arg;
    return env->pending ? status(env, napi_pending_exception) : napi_ok;
}
static void pending(napi_env env, void *value) {
    if (!env->pending && value) {
        env->pending = value;
        wr_protect(env->ctx, value);
    }
}
static napi_status exception(napi_env env, void *value) {
    pending(env, value);
    return status(env, napi_pending_exception);
}
static void unwind(napi_env env, size_t mark) {
    while (env->roots.size() > mark) {
        wr_unprotect(env->ctx, env->roots.back());
        env->roots.pop_back();
    }
}
struct Frame {
    napi_env env;
    size_t mark, depth;
    explicit Frame(napi_env value)
        : env(value), mark(value->roots.size()), depth(value->scopes.size()) {
    }
    ~Frame() {
        while (env->scopes.size() > depth) {
            delete env->scopes.back();
            env->scopes.pop_back();
        }
        unwind(env, mark);
    }
};
static napi_status result(napi_env env, void *value, napi_value *out) {
    if (!out || !value)
        return status(env, napi_invalid_arg);
    if (env->roots.size() >= env->max_handles)
        return status(env, napi_generic_failure);
    env->roots.push_back(value);
    wr_protect(env->ctx, value);
    *out = value;
    return status(env, napi_ok);
}
static void *property(void *ctx, void *object, const char *name, void **ex) {
    void *key = wr_string_utf8(name);
    void *value = wr_get(ctx, object, key, ex);
    wr_string_release(key);
    return value;
}
static void assign(napi_env env, void *object, const char *name, void *value, void **ex) {
    void *key = wr_string_utf8(name);
    wr_set(env->ctx, object, key, value, 0, ex);
    wr_string_release(key);
}
static void *string_value(napi_env env, const std::vector<uint16_t> &units) {
    void *s =
        wr_string_utf16(const_cast<uint16_t *>(units.data()), static_cast<int64_t>(units.size()));
    if (!s)
        return nullptr;
    void *v = wr_string_value(env->ctx, s);
    wr_string_release(s);
    return v;
}
static std::vector<uint16_t> decode_utf8(const char *input, size_t length) {
    const auto *s = reinterpret_cast<const unsigned char *>(input);
    std::vector<uint16_t> out;
    out.reserve(length);
    for (size_t i = 0; i < length;) {
        uint32_t c = s[i++];
        if (c < 128) {
            out.push_back(static_cast<uint16_t>(c));
            continue;
        }
        unsigned remaining = c >= 0xc2 && c <= 0xdf   ? 1
                             : c >= 0xe0 && c <= 0xef ? 2
                             : c >= 0xf0 && c <= 0xf4 ? 3
                                                      : 0;
        if (!remaining) {
            out.push_back(0xfffd);
            continue;
        }
        uint32_t cp = c & ((1u << (6 - remaining)) - 1);
        bool good = true;
        for (unsigned j = 0; j < remaining; ++j) {
            if (i >= length || s[i] < 0x80 || s[i] > 0xbf ||
                (!j && ((c == 0xe0 && s[i] < 0xa0) || (c == 0xed && s[i] > 0x9f) ||
                        (c == 0xf0 && s[i] < 0x90) || (c == 0xf4 && s[i] > 0x8f)))) {
                good = false;
                break;
            }
            cp = (cp << 6) | (s[i++] & 63);
        }
        if (!good) {
            out.push_back(0xfffd);
            continue;
        }
        if (cp <= 0xffff)
            out.push_back(static_cast<uint16_t>(cp));
        else {
            cp -= 0x10000;
            out.push_back(static_cast<uint16_t>(0xd800 + (cp >> 10)));
            out.push_back(static_cast<uint16_t>(0xdc00 + (cp & 1023)));
        }
    }
    return out;
}
#define READY(e)                                                                                   \
    do {                                                                                           \
        napi_status check = ready(e);                                                              \
        if (check != napi_ok)                                                                      \
            return check;                                                                          \
    } while (0)
#define NEED(e, condition, code)                                                                   \
    do {                                                                                           \
        if (!(condition))                                                                          \
            return status(e, code);                                                                \
    } while (0)
extern "C" napi_status napi_get_version(napi_env env, uint32_t *out) {
    READY(env);
    NEED(env, out, napi_invalid_arg);
    *out = 1;
    return status(env, napi_ok);
}
extern "C" napi_status napi_get_last_error_info(napi_env env,
                                                const napi_extended_error_info **out) {
    if (!valid(env) || !out)
        return napi_invalid_arg;
    *out = &env->error;
    return napi_ok;
}
extern "C" napi_status napi_get_undefined(napi_env env, napi_value *out) {
    READY(env);
    return result(env, wr_undefined(env->ctx), out);
}
extern "C" napi_status napi_get_null(napi_env env, napi_value *out) {
    READY(env);
    return result(env, wr_null(env->ctx), out);
}
extern "C" napi_status napi_get_global(napi_env env, napi_value *out) {
    READY(env);
    return result(env, wr_context_global(env->ctx), out);
}
extern "C" napi_status napi_get_boolean(napi_env env, bool value, napi_value *out) {
    READY(env);
    return result(env, wr_boolean(env->ctx, value), out);
}
extern "C" napi_status napi_create_double(napi_env env, double value, napi_value *out) {
    READY(env);
    return result(env, wr_number(env->ctx, value), out);
}
extern "C" napi_status napi_create_int32(napi_env e, int32_t v, napi_value *o) {
    return napi_create_double(e, v, o);
}
extern "C" napi_status napi_create_uint32(napi_env e, uint32_t v, napi_value *o) {
    return napi_create_double(e, v, o);
}
extern "C" napi_status napi_create_int64(napi_env e, int64_t v, napi_value *o) {
    return napi_create_double(e, static_cast<double>(v), o);
}
extern "C" napi_status napi_get_value_double(napi_env env, napi_value value, double *out) {
    READY(env);
    NEED(env, value && out, napi_invalid_arg);
    NEED(env, wr_type(env->ctx, value) == 3, napi_number_expected);
    void *ex = nullptr;
    *out = wr_to_number(env->ctx, value, &ex);
    return ex ? exception(env, ex) : status(env, napi_ok);
}
extern "C" napi_status napi_get_value_uint32(napi_env env, napi_value value, uint32_t *out) {
    READY(env);
    NEED(env, out, napi_invalid_arg);
    double number;
    napi_status s = napi_get_value_double(env, value, &number);
    if (s != napi_ok)
        return s;
    if (!std::isfinite(number))
        number = 0;
    number = std::fmod(std::trunc(number), 4294967296.0);
    if (number < 0)
        number += 4294967296.0;
    *out = static_cast<uint32_t>(number);
    return status(env, napi_ok);
}
extern "C" napi_status napi_get_value_int32(napi_env env, napi_value value, int32_t *out) {
    READY(env);
    NEED(env, out, napi_invalid_arg);
    uint32_t number;
    napi_status s = napi_get_value_uint32(env, value, &number);
    if (s == napi_ok) {
        int64_t signed_value = number;
        if (signed_value >= 2147483648LL)
            signed_value -= 4294967296LL;
        *out = static_cast<int32_t>(signed_value);
    }
    return s;
}
extern "C" napi_status napi_get_value_int64(napi_env env, napi_value value, int64_t *out) {
    READY(env);
    NEED(env, out, napi_invalid_arg);
    double number;
    napi_status s = napi_get_value_double(env, value, &number);
    if (s != napi_ok)
        return s;
    // The Node-API contract returns 0 for every non-finite value (NaN and both infinities); finite
    // values beyond the int64 range still saturate.
    if (!std::isfinite(number))
        *out = 0;
    else if (number >= 9223372036854775808.0)
        *out = INT64_MAX;
    else if (number <= -9223372036854775808.0)
        *out = INT64_MIN;
    else
        *out = static_cast<int64_t>(number);
    return status(env, napi_ok);
}
extern "C" napi_status napi_get_value_bool(napi_env env, napi_value value, bool *out) {
    READY(env);
    NEED(env, value && out, napi_invalid_arg);
    NEED(env, wr_type(env->ctx, value) == 2, napi_boolean_expected);
    *out = wr_to_boolean(env->ctx, value);
    return status(env, napi_ok);
}
extern "C" napi_status napi_typeof(napi_env env, napi_value value, napi_valuetype *out) {
    READY(env);
    NEED(env, value && out, napi_invalid_arg);
    int type = wr_type(env->ctx, value);
    static const napi_valuetype types[] = {napi_undefined, napi_null,   napi_boolean, napi_number,
                                           napi_string,    napi_object, napi_symbol,  napi_bigint};
    NEED(env, type >= 0 && type < 8, napi_invalid_arg);
    *out = types[type];
    if (type == 5 && wr_callable(env->ctx, value))
        *out = napi_function;
    return status(env, napi_ok);
}
extern "C" napi_status napi_strict_equals(napi_env env, napi_value a, napi_value b, bool *out) {
    READY(env);
    NEED(env, a && b && out, napi_invalid_arg);
    *out = wr_equal(env->ctx, a, b);
    return status(env, napi_ok);
}
extern "C" napi_status napi_create_string_utf8(napi_env env, const char *s, size_t length,
                                               napi_value *out) {
    READY(env);
    NEED(env, s && out, napi_invalid_arg);
    if (length == NAPI_AUTO_LENGTH)
        length = std::strlen(s);
    NEED(env, length <= env->max_string, napi_invalid_arg);
    return result(env, string_value(env, decode_utf8(s, length)), out);
}
extern "C" napi_status napi_create_string_latin1(napi_env env, const char *s, size_t length,
                                                 napi_value *out) {
    READY(env);
    NEED(env, s && out, napi_invalid_arg);
    if (length == NAPI_AUTO_LENGTH)
        length = std::strlen(s);
    NEED(env, length <= env->max_string, napi_invalid_arg);
    std::vector<uint16_t> units;
    units.reserve(length);
    for (size_t i = 0; i < length; ++i)
        units.push_back(static_cast<unsigned char>(s[i]));
    return result(env, string_value(env, units), out);
}
extern "C" napi_status napi_create_string_utf16(napi_env env, const uint16_t *s, size_t length,
                                                napi_value *out) {
    READY(env);
    NEED(env, s && out, napi_invalid_arg);
    if (length == NAPI_AUTO_LENGTH) {
        length = 0;
        while (length <= env->max_string / 2 && s[length])
            ++length;
    }
    NEED(env, length <= env->max_string / 2, napi_invalid_arg);
    void *string = wr_string_utf16(const_cast<uint16_t *>(s), static_cast<int64_t>(length));
    if (!string)
        return status(env, napi_generic_failure);
    void *value = wr_string_value(env->ctx, string);
    wr_string_release(string);
    return result(env, value, out);
}
extern "C" napi_status napi_get_value_string_utf8(napi_env env, napi_value value, char *out,
                                                  size_t size, size_t *written) {
    READY(env);
    NEED(env, value && (out || written), napi_invalid_arg);
    NEED(env, wr_type(env->ctx, value) == 4, napi_string_expected);
    void *ex = nullptr, *string = wr_to_string(env->ctx, value, &ex);
    if (ex)
        return exception(env, ex);
    size_t capacity = static_cast<size_t>(wr_string_utf8_capacity(string));
    if (capacity > env->max_string * 3 + 1) {
        wr_string_release(string);
        return status(env, napi_generic_failure);
    }
    std::vector<char> bytes(capacity);
    int64_t used = wr_string_copy_utf8(string, bytes.data(), static_cast<int64_t>(capacity));
    wr_string_release(string);
    NEED(env, used > 0, napi_generic_failure);
    size_t length = static_cast<size_t>(used - 1), count = length;
    if (out) {
        count = size ? std::min(size - 1, length) : 0;
        while (count && count < length && (static_cast<unsigned char>(bytes[count]) & 0xc0) == 0x80)
            --count;
        if (size) {
            std::memcpy(out, bytes.data(), count);
            out[count] = 0;
        }
    }
    if (written)
        *written = count;
    return status(env, napi_ok);
}
extern "C" napi_status napi_get_value_string_utf16(napi_env env, napi_value value, uint16_t *out,
                                                   size_t size, size_t *written) {
    READY(env);
    NEED(env, value && (out || written), napi_invalid_arg);
    NEED(env, wr_type(env->ctx, value) == 4, napi_string_expected);
    void *ex = nullptr, *string = wr_to_string(env->ctx, value, &ex);
    if (ex)
        return exception(env, ex);
    size_t length = static_cast<size_t>(wr_string_length(string)),
           count = out ? (size ? std::min(size - 1, length) : 0) : length;
    if (out && size) {
        std::memcpy(out, wr_string_characters(string), count * 2);
        out[count] = 0;
    }
    wr_string_release(string);
    if (written)
        *written = count;
    return status(env, napi_ok);
}
extern "C" napi_status napi_create_object(napi_env env, napi_value *out) {
    READY(env);
    return result(env, wr_object(env->ctx, nullptr, nullptr), out);
}
extern "C" napi_status napi_create_array_with_length(napi_env env, size_t length, napi_value *out) {
    READY(env);
    NEED(env, out && length <= UINT32_MAX, napi_invalid_arg);
    void *ex = nullptr, *value = wr_array(env->ctx, 0, nullptr, &ex);
    if (ex)
        return exception(env, ex);
    napi_status s = result(env, value, out);
    if (s != napi_ok)
        return s;
    assign(env, value, "length", wr_number(env->ctx, static_cast<double>(length)), &ex);
    return ex ? exception(env, ex) : status(env, napi_ok);
}
extern "C" napi_status napi_create_array(napi_env env, napi_value *out) {
    return napi_create_array_with_length(env, 0, out);
}
extern "C" napi_status napi_is_array(napi_env env, napi_value value, bool *out) {
    READY(env);
    NEED(env, value && out, napi_invalid_arg);
    void *ex = nullptr, *args[] = {value},
         *answer = wr_call(env->ctx, env->is_array, nullptr, 1, args, &ex);
    if (ex)
        return exception(env, ex);
    *out = wr_to_boolean(env->ctx, answer);
    return status(env, napi_ok);
}
extern "C" napi_status napi_get_array_length(napi_env env, napi_value value, uint32_t *out) {
    READY(env);
    NEED(env, value && out, napi_invalid_arg);
    bool array = false;
    napi_status array_status = napi_is_array(env, value, &array);
    if (array_status != napi_ok)
        return array_status;
    NEED(env, array, napi_array_expected);
    napi_value length;
    napi_status s = napi_get_named_property(env, value, "length", &length);
    return s == napi_ok ? napi_get_value_uint32(env, length, out) : s;
}
extern "C" napi_status napi_get_named_property(napi_env env, napi_value object, const char *name,
                                               napi_value *out) {
    READY(env);
    NEED(env, object && name && out, napi_invalid_arg);
    NEED(env, wr_is_object(env->ctx, object), napi_object_expected);
    void *ex = nullptr, *value = property(env->ctx, object, name, &ex);
    return ex ? exception(env, ex) : result(env, value, out);
}
extern "C" napi_status napi_set_named_property(napi_env env, napi_value object, const char *name,
                                               napi_value value) {
    READY(env);
    NEED(env, object && name && value, napi_invalid_arg);
    NEED(env, wr_is_object(env->ctx, object), napi_object_expected);
    void *ex = nullptr;
    assign(env, object, name, value, &ex);
    return ex ? exception(env, ex) : status(env, napi_ok);
}
extern "C" napi_status napi_has_named_property(napi_env env, napi_value object, const char *name,
                                               bool *out) {
    READY(env);
    NEED(env, object && name && out, napi_invalid_arg);
    NEED(env, wr_is_object(env->ctx, object), napi_object_expected);
    napi_value key;
    napi_status s = napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &key);
    if (s != napi_ok)
        return s;
    void *ex = nullptr, *args[] = {object, key},
         *answer = wr_call(env->ctx, env->has, nullptr, 2, args, &ex);
    if (ex)
        return exception(env, ex);
    *out = wr_to_boolean(env->ctx, answer);
    return status(env, napi_ok);
}
extern "C" napi_status napi_get_element(napi_env env, napi_value object, uint32_t index,
                                        napi_value *out) {
    READY(env);
    NEED(env, object && out, napi_invalid_arg);
    NEED(env, wr_is_object(env->ctx, object), napi_object_expected);
    void *ex = nullptr, *value = wr_get_index(env->ctx, object, index, &ex);
    return ex ? exception(env, ex) : result(env, value, out);
}
extern "C" napi_status napi_set_element(napi_env env, napi_value object, uint32_t index,
                                        napi_value value) {
    READY(env);
    NEED(env, object && value, napi_invalid_arg);
    NEED(env, wr_is_object(env->ctx, object), napi_object_expected);
    void *ex = nullptr;
    wr_set_index(env->ctx, object, index, value, &ex);
    return ex ? exception(env, ex) : status(env, napi_ok);
}
static napi_status define_property(napi_env env, void *object, void *key,
                                   const napi_property_descriptor &p) {
    napi_value descriptor;
    napi_status s = napi_create_object(env, &descriptor);
    if (s != napi_ok)
        return s;
    wr_set_prototype(env->ctx, descriptor, wr_null(env->ctx));
    void *ex = nullptr;
    assign(env, descriptor, "enumerable",
           wr_boolean(env->ctx, (p.attributes & napi_enumerable) != 0), &ex);
    assign(env, descriptor, "configurable",
           wr_boolean(env->ctx, (p.attributes & napi_configurable) != 0), &ex);
    if (p.method || (!p.getter && !p.setter)) {
        napi_value value = p.value ? p.value : wr_undefined(env->ctx);
        if (p.method) {
            s = napi_create_function(env, p.utf8name ? p.utf8name : "", NAPI_AUTO_LENGTH, p.method,
                                     p.data, &value);
            if (s != napi_ok)
                return s;
        }
        assign(env, descriptor, "value", value, &ex);
        assign(env, descriptor, "writable",
               wr_boolean(env->ctx, (p.attributes & napi_writable) != 0), &ex);
    } else {
        if (p.getter) {
            napi_value getter;
            s = napi_create_function(env, "get", 3, p.getter, p.data, &getter);
            if (s != napi_ok)
                return s;
            assign(env, descriptor, "get", getter, &ex);
        }
        if (p.setter) {
            napi_value setter;
            s = napi_create_function(env, "set", 3, p.setter, p.data, &setter);
            if (s != napi_ok)
                return s;
            assign(env, descriptor, "set", setter, &ex);
        }
    }
    if (ex)
        return exception(env, ex);
    void *args[] = {object, key, descriptor};
    void *value = wr_call(env->ctx, env->define, nullptr, 3, args, &ex);
    if (ex)
        return exception(env, ex);
    return status(env, value && wr_to_boolean(env->ctx, value) ? napi_ok : napi_generic_failure);
}
extern "C" napi_status napi_define_properties(napi_env env, napi_value object, size_t count,
                                              const napi_property_descriptor *properties) {
    READY(env);
    NEED(env, object && (!count || properties), napi_invalid_arg);
    NEED(env, wr_is_object(env->ctx, object), napi_object_expected);
    NEED(env, count <= env->max_functions, napi_invalid_arg);
    for (size_t i = 0; i < count; ++i) {
        Frame frame(env);
        napi_value key = properties[i].name;
        if (properties[i].utf8name) {
            napi_status s =
                napi_create_string_utf8(env, properties[i].utf8name, NAPI_AUTO_LENGTH, &key);
            if (s != napi_ok)
                return s;
        }
        NEED(env, key, napi_name_expected);
        int type = wr_type(env->ctx, key);
        NEED(env, type == 4 || type == 6, napi_name_expected);
        napi_status s = define_property(env, object, key, properties[i]);
        if (s != napi_ok)
            return s;
    }
    return status(env, napi_ok);
}
static napi_status create_error(napi_env env, int kind, napi_value code, napi_value message,
                                napi_value *out) {
    READY(env);
    NEED(env, message && out, napi_invalid_arg);
    NEED(env, wr_type(env->ctx, message) == 4, napi_string_expected);
    NEED(env, !code || wr_type(env->ctx, code) == 4, napi_string_expected);
    void *ex = nullptr, *args[] = {message};
    void *value = wr_construct(env->ctx, env->errors[kind], 1, args, &ex);
    if (ex)
        return exception(env, ex);
    napi_status s = result(env, value, out);
    if (s != napi_ok || !code)
        return s;
    napi_property_descriptor property = {
        "code", nullptr, nullptr, nullptr, nullptr, code, static_cast<napi_property_attributes>(7),
        nullptr};
    return napi_define_properties(env, value, 1, &property);
}
extern "C" napi_status napi_create_error(napi_env e, napi_value c, napi_value m, napi_value *o) {
    return create_error(e, 0, c, m, o);
}
extern "C" napi_status napi_create_type_error(napi_env e, napi_value c, napi_value m,
                                              napi_value *o) {
    return create_error(e, 1, c, m, o);
}
extern "C" napi_status napi_create_range_error(napi_env e, napi_value c, napi_value m,
                                               napi_value *o) {
    return create_error(e, 2, c, m, o);
}
extern "C" napi_status napi_throw(napi_env env, napi_value value) {
    READY(env);
    NEED(env, value, napi_invalid_arg);
    pending(env, value);
    return status(env, napi_ok);
}
static napi_status throw_error(napi_env env, int kind, const char *code, const char *message) {
    READY(env);
    NEED(env, message, napi_invalid_arg);
    napi_value c = nullptr, m, value;
    napi_status s = napi_create_string_utf8(env, message, NAPI_AUTO_LENGTH, &m);
    if (s != napi_ok)
        return s;
    if (code) {
        s = napi_create_string_utf8(env, code, NAPI_AUTO_LENGTH, &c);
        if (s != napi_ok)
            return s;
    }
    s = create_error(env, kind, c, m, &value);
    return s == napi_ok ? napi_throw(env, value) : s;
}
extern "C" napi_status napi_throw_error(napi_env e, const char *c, const char *m) {
    return throw_error(e, 0, c, m);
}
extern "C" napi_status napi_throw_type_error(napi_env e, const char *c, const char *m) {
    return throw_error(e, 1, c, m);
}
extern "C" napi_status napi_throw_range_error(napi_env e, const char *c, const char *m) {
    return throw_error(e, 2, c, m);
}
extern "C" napi_status napi_is_exception_pending(napi_env env, bool *out) {
    if (!valid(env) || !out)
        return napi_invalid_arg;
    *out = env->pending != nullptr;
    return status(env, napi_ok);
}
extern "C" napi_status napi_get_and_clear_last_exception(napi_env env, napi_value *out) {
    if (!valid(env) || !out)
        return napi_invalid_arg;
    void *value = env->pending ? env->pending : wr_undefined(env->ctx);
    napi_status s = result(env, value, out);
    if (s == napi_ok && env->pending) {
        wr_unprotect(env->ctx, env->pending);
        env->pending = nullptr;
    }
    return s;
}
extern "C" napi_status napi_open_handle_scope(napi_env env, napi_handle_scope *out) {
    READY(env);
    NEED(env, out && env->scopes.size() < 128, napi_invalid_arg);
    auto scope = std::make_unique<napi_handle_scope__>();
    scope->mark = env->roots.size();
    env->scopes.push_back(scope.get());
    *out = scope.release();
    return status(env, napi_ok);
}
extern "C" napi_status napi_close_handle_scope(napi_env env, napi_handle_scope scope) {
    if (!valid(env))
        return napi_invalid_arg;
    NEED(env, scope && !env->scopes.empty() && env->scopes.back() == scope,
         napi_handle_scope_mismatch);
    unwind(env, scope->mark);
    env->scopes.pop_back();
    delete scope;
    return status(env, napi_ok);
}
static void *dispatch(const void *ctx, void *function, void *receiver, size_t argc, void **argv,
                      void **ex) {
    napi_env env = find_env(const_cast<void *>(ctx));
    if (!valid(env))
        return wr_undefined(const_cast<void *>(ctx));
    napi_callback callback = nullptr;
    void *data = nullptr;
    for (auto &entry : env->functions)
        if (entry.function == function) {
            callback = entry.callback;
            data = entry.data;
            break;
        }
    if (!callback)
        return wr_undefined(env->ctx);
    Frame frame(env);
    napi_callback_info__ info = {env, argc, argv, receiver, data};
    void *value = nullptr;
    try {
        value = callback(env, &info);
    } catch (const std::bad_alloc &) {
        std::terminate();
    } catch (...) {
        throw_error(env, 0, "ERR_NATIVE_EXCEPTION", "native callback threw a C++ exception");
    }
    if (env->pending) {
        *ex = env->pending;
        wr_unprotect(env->ctx, env->pending);
        env->pending = nullptr;
    }
    return value ? value : wr_undefined(env->ctx);
}
extern "C" napi_status napi_create_function(napi_env env, const char *name, size_t length,
                                            napi_callback callback, void *data, napi_value *out) {
    READY(env);
    NEED(env, callback && out && (name || !length), napi_invalid_arg);
    NEED(env, env->functions.size() < env->max_functions, napi_generic_failure);
    napi_value label;
    napi_status s = napi_create_string_utf8(env, name ? name : "", name ? length : 0, &label);
    if (s != napi_ok)
        return s;
    void *ex = nullptr, *string = wr_to_string(env->ctx, label, &ex);
    if (ex)
        return exception(env, ex);
    void *value = wr_function(env->ctx, string, reinterpret_cast<void *>(dispatch));
    wr_string_release(string);
    if (!value)
        return status(env, napi_generic_failure);
    env->functions.push_back({value, callback, data});
    wr_protect(env->ctx, value);
    return result(env, value, out);
}
extern "C" napi_status napi_get_cb_info(napi_env env, napi_callback_info info, size_t *argc,
                                        napi_value *argv, napi_value *receiver, void **data) {
    READY(env);
    NEED(env, info && info->env == env && (!argv || argc), napi_invalid_arg);
    if (argc) {
        if (argv) {
            size_t capacity = *argc;
            for (size_t i = 0; i < capacity; ++i)
                argv[i] = i < info->argc ? info->argv[i] : wr_undefined(env->ctx);
        }
        *argc = info->argc;
    }
    if (receiver)
        *receiver = info->receiver;
    if (data)
        *data = info->data;
    return status(env, napi_ok);
}
extern "C" napi_status napi_get_new_target(napi_env env, napi_callback_info info, napi_value *out) {
    READY(env);
    NEED(env, info && info->env == env && out, napi_invalid_arg);
    *out = nullptr;
    return status(env, napi_ok);
}
extern "C" napi_status napi_call_function(napi_env env, napi_value receiver, napi_value function,
                                          size_t argc, const napi_value *argv, napi_value *out) {
    READY(env);
    NEED(env, receiver && function && (!argc || argv) && argc <= 65536, napi_invalid_arg);
    NEED(env, wr_is_object(env->ctx, function) && wr_callable(env->ctx, function),
         napi_function_expected);
    for (size_t i = 0; i < argc; ++i)
        NEED(env, argv[i], napi_invalid_arg);
    void *ex = nullptr,
         *array = wr_array(env->ctx, static_cast<int64_t>(argc), const_cast<void **>(argv), &ex);
    if (ex)
        return exception(env, ex);
    napi_value rooted;
    napi_status s = result(env, array, &rooted);
    if (s != napi_ok)
        return s;
    void *arguments[] = {function, receiver, array};
    void *value = wr_call(env->ctx, env->apply, nullptr, 3, arguments, &ex);
    if (ex)
        return exception(env, ex);
    return out ? result(env, value, out) : status(env, napi_ok);
}
extern "C" bool jsrt_addon_prepare(void *ctx, int64_t modules, int64_t functions, int64_t handles,
                                   int64_t strings) {
    if (auto existing = find_env(ctx))
        return valid(existing);
    try {
        auto env = std::make_unique<napi_env__>();
        env->ctx = ctx;
        env->max_modules = modules;
        env->max_functions = functions;
        env->max_handles = handles;
        env->max_string = strings;
        void *ex = nullptr, *global = wr_context_global(ctx),
             *reflect = property(ctx, global, "Reflect", &ex);
        if (ex)
            return false;
        env->define = property(ctx, reflect, "defineProperty", &ex);
        if (ex || !env->define)
            return false;
        wr_protect(ctx, env->define);
        env->has = property(ctx, reflect, "has", &ex);
        if (env->has)
            wr_protect(ctx, env->has);
        env->apply = property(ctx, reflect, "apply", &ex);
        if (env->apply)
            wr_protect(ctx, env->apply);
        void *array = property(ctx, global, "Array", &ex);
        env->is_array = ex ? nullptr : property(ctx, array, "isArray", &ex);
        if (env->is_array)
            wr_protect(ctx, env->is_array);
        const char *names[] = {"Error", "TypeError", "RangeError"};
        for (int i = 0; i < 3; ++i) {
            env->errors[i] = property(ctx, global, names[i], &ex);
            if (env->errors[i])
                wr_protect(ctx, env->errors[i]);
        }
        if (ex) {
            for (void *error : env->errors)
                if (error)
                    wr_unprotect(ctx, error);
            if (env->has)
                wr_unprotect(ctx, env->has);
            if (env->apply)
                wr_unprotect(ctx, env->apply);
            if (env->is_array)
                wr_unprotect(ctx, env->is_array);
            wr_unprotect(ctx, env->define);
            return false;
        }
        environments.push_back(std::move(env));
        return true;
    } catch (const std::bad_alloc &) {
        std::terminate();
    }
}
extern "C" void *jsrt_addon_load(void *ctx, const char *path, void *exports, void **ex) {
    napi_env env = find_env(ctx);
    if (!valid(env))
        return wr_undefined(ctx);
    Frame frame(env);
    void *answer = exports;
    try {
        if (env->libraries.size() >= env->max_modules)
            throw_error(env, 2, "ERR_ADDON_LIMIT", "native addon library limit exceeded");
        else {
            void *library = dlopen(path, RTLD_NOW | RTLD_LOCAL);
            if (!library)
                throw_error(env, 0, "ERR_DLOPEN_FAILED", dlerror());
            else {
                // Retain even failed initializers: their functions may have escaped into JS.
                env->libraries.push_back(library);
                auto version = reinterpret_cast<int32_t (*)()>(
                    dlsym(library, "node_api_module_get_api_version_v1"));
                auto init = reinterpret_cast<napi_value (*)(napi_env, napi_value)>(
                    dlsym(library, "napi_register_module_v1"));
                if (!init)
                    throw_error(env, 0, "ERR_DLOPEN_FAILED",
                                "addon has no napi_register_module_v1 export");
                else if (version && version() != 1)
                    throw_error(env, 0, "ERR_NAPI_VERSION",
                                "only the documented Node-API v1 subset is implemented");
                else {
                    void *value = init(env, exports);
                    if (value)
                        answer = value;
                }
            }
        }
    } catch (const std::bad_alloc &) {
        std::terminate();
    } catch (...) {
        throw_error(env, 0, "ERR_NATIVE_EXCEPTION",
                    "native addon initializer threw a C++ exception");
    }
    if (env->pending) {
        *ex = env->pending;
        wr_unprotect(ctx, env->pending);
        env->pending = nullptr;
    }
    return answer;
}
extern "C" void jsrt_addon_stop(void *ctx) {
    napi_env env = find_env(ctx);
    if (!env || env->stopping)
        return;
    while (!env->scopes.empty()) {
        delete env->scopes.back();
        env->scopes.pop_back();
    }
    unwind(env, 0);
    for (auto &function : env->functions)
        wr_unprotect(ctx, function.function);
    env->functions.clear();
    if (env->pending) {
        wr_unprotect(ctx, env->pending);
        env->pending = nullptr;
    }
    for (void *error : env->errors)
        wr_unprotect(ctx, error);
    wr_unprotect(ctx, env->define);
    wr_unprotect(ctx, env->has);
    wr_unprotect(ctx, env->apply);
    wr_unprotect(ctx, env->is_array);
    env->stopping = true;
}
extern "C" void jsrt_addon_context_disposed(void *ctx) {
    for (auto i = environments.begin(); i != environments.end(); ++i) {
        if ((*i)->ctx != ctx)
            continue;
        // All protected JS handles were released before context disposal.
        for (auto library = (*i)->libraries.rbegin(); library != (*i)->libraries.rend(); ++library)
            dlclose(*library);
        environments.erase(i);
        return;
    }
}
