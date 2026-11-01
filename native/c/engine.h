#ifndef JSRT_ENGINE_H
#define JSRT_ENGINE_H
#include <stdbool.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
void *wr_active_context(void);
void wr_bind_context(void *context);
void wr_checkpoint(void *context, void **exception);
// Opaque context, value and refcounted UTF-16 string handles. 64-bit Linux ABI.
void *wr_context_create(void *global_class);
void wr_context_release(void *context);
void *wr_context_global(void *context);
void *wr_string_utf8(const char *text);
void wr_string_release(void *text);
int64_t wr_string_utf8_capacity(void *text);
int64_t wr_string_copy_utf8(void *text, void *output, int64_t capacity);
void *wr_evaluate(void *context, void *source, void *this_object, void *url, int32_t line,
                  void **exception);
void *wr_to_string(void *context, void *value, void **exception);
void *wr_undefined(void *context);
void *wr_string_value(void *context, void *text);
bool wr_is_object(void *context, void *value);
bool wr_is_undefined(void *context, void *value);
void wr_protect(void *context, void *value);
void wr_unprotect(void *context, void *value);
void *wr_object(void *context, void *js_class, void *data);
void *wr_function(void *context, void *name, void *callback);
void *wr_compile_function(void *context, void *name, uint32_t count, void **parameters, void *body,
                          void *url, int32_t line, void **exception);
void *wr_promise(void *context, void **resolve, void **reject, void **exception);
void wr_rejection_handler(void *context, void *function, void **exception);
void wr_set(void *context, void *object, void *name, void *value, uint32_t attributes,
            void **exception);
void *wr_get(void *context, void *object, void *name, void **exception);
void *wr_number(void *context, double value);
double wr_to_number(void *context, void *value, void **exception);
bool wr_callable(void *context, void *object);
void *wr_call(void *context, void *function, void *this_object, int64_t count, void **args,
              void **exception);
void *wr_construct(void *context, void *constructor, int64_t count, void **args, void **exception);
int32_t wr_type(void *ctx, void *value);
void *wr_null(void *ctx);
void *wr_boolean(void *ctx, bool value);
bool wr_to_boolean(void *ctx, void *value);
void *wr_to_object(void *ctx, void *value, void **ex);
bool wr_equal(void *ctx, void *a, void *b);
void *wr_string_utf16(uint16_t *text, int64_t length);
uint16_t *wr_string_characters(void *text);
int64_t wr_string_length(void *text);
bool wr_string_equal(void *a, void *b);
void *wr_array(void *ctx, int64_t length, void **values, void **ex);
void *wr_get_prototype(void *ctx, void *object);
void wr_set_prototype(void *ctx, void *object, void *value);
bool wr_delete(void *ctx, void *obj, void *key, void **ex);
bool wr_has(void *ctx, void *obj, void *key);
void *wr_get_index(void *ctx, void *obj, uint32_t index, void **ex);
void wr_set_index(void *ctx, void *obj, uint32_t index, void *value, void **ex);
void *wr_constructor(void *ctx, void *callback);
/* The pinned engine introduced this generic factory in Worker ABI v2. */
typedef uint32_t (*jsrt_constructor_version_fn)(void);
typedef void *(*jsrt_constructor_factory_fn)(void *, void *, void *);
bool jsrt_callable_constructor_available(void);
void *jsrt_create_callable_constructor(void *, void *, void *);
void *jsrt_create_callable_constructor_with_abi(void *, void *, void *, jsrt_constructor_version_fn,
                                                jsrt_constructor_factory_fn);
bool wr_is_array(void *ctx, void *value);
int32_t wr_typed_type(void *ctx, void *value, void **ex);
void *wr_u8_new(void *ctx, int64_t length, void **ex);
void *wr_u8_view(void *ctx, void *buffer, int64_t offset, int64_t length, void **ex);
void *wr_typed_buffer(void *ctx, void *value, void **ex);
int64_t wr_typed_length(void *ctx, void *value, void **ex);
int64_t wr_typed_offset(void *ctx, void *value, void **ex);
void *wr_typed_bytes(void *ctx, void *value, void **ex);
int64_t wr_array_buffer_length(void *ctx, void *value, void **ex);
void *wr_external_buffer(void *ctx, void *bytes, int64_t length, void *deallocator, void **ex);
void *wr_array_buffer_bytes(void *ctx, void *value, void **ex);
const char *wr_engine_name(void);
void *wr_context_data(void *context);
bool wr_context_set_data(void *context, void *data);
const char *wr_engine_version(void);
uint32_t wr_engine_major(void);
uint32_t wr_engine_minor(void);
uint32_t wr_engine_micro(void);
uint32_t wr_engine_patch(void);
#ifdef __cplusplus
}
#endif
#endif
