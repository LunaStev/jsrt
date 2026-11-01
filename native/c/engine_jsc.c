#include "engine.h"
#include <stdio.h>
#include <dlfcn.h>
#include "../include/jsrt_modules.h"

bool jsrt_prepare_worker_termination(void *group) {
    bool (*prepare)(void *) = (bool (*)(void *))dlsym(RTLD_DEFAULT, "JSRTPrepareWorkerTermination");
    return group && prepare && prepare(group);
}

bool jsrt_worker_engine_available(void) {
    uint32_t (*version)(void) = (uint32_t (*)(void))dlsym(RTLD_DEFAULT, "JSRTWorkerABIVersion");
    return version && version() == 2 && dlsym(RTLD_DEFAULT, "JSRTPrepareWorkerTermination") &&
           dlsym(RTLD_DEFAULT, "JSRTRequestTermination") &&
           dlsym(RTLD_DEFAULT, "JSRTDrainOwnerRunLoop") && jsrt_callable_constructor_available();
}

void jsrt_drain_owner_runloop(void) {
    void (*drain)(void) = (void (*)(void))dlsym(RTLD_DEFAULT, "JSRTDrainOwnerRunLoop");
    if (drain) {
        drain();
    }
}

enum { JSRT_CALLABLE_CONSTRUCTOR_ABI = 2 };

bool jsrt_callable_constructor_available(void) {
    jsrt_constructor_version_fn version =
        (jsrt_constructor_version_fn)dlsym(RTLD_DEFAULT, "JSRTWorkerABIVersion");
    return version && version() == JSRT_CALLABLE_CONSTRUCTOR_ABI &&
           dlsym(RTLD_DEFAULT, "JSRTMakeConstructor");
}

void *jsrt_create_callable_constructor_with_abi(void *context, void *call, void *construct,
                                                jsrt_constructor_version_fn version,
                                                jsrt_constructor_factory_fn factory) {
    if (!context || !call || !construct || !version || !factory) {
        return NULL;
    }
    if (version() != JSRT_CALLABLE_CONSTRUCTOR_ABI) {
        return NULL;
    }
    return factory(context, call, construct);
}

void *jsrt_create_callable_constructor(void *context, void *call, void *construct) {
    jsrt_constructor_version_fn version =
        (jsrt_constructor_version_fn)dlsym(RTLD_DEFAULT, "JSRTWorkerABIVersion");
    jsrt_constructor_factory_fn factory =
        (jsrt_constructor_factory_fn)dlsym(RTLD_DEFAULT, "JSRTMakeConstructor");
    return jsrt_create_callable_constructor_with_abi(context, call, construct, version, factory);
}

bool jsrt_clone_engine_available(void) {
    uint32_t (*version)(void) = (uint32_t (*)(void))dlsym(RTLD_DEFAULT, "JSRTCloneABIVersion");
    return version && version() == 1 && dlsym(RTLD_DEFAULT, "JSRTIsProxy");
}

int32_t jsrt_clone_proxy_status(void *context, void *value) {
    bool (*probe)(void *, void *) = (bool (*)(void *, void *))dlsym(RTLD_DEFAULT, "JSRTIsProxy");
    if (!jsrt_clone_engine_available() || !probe) {
        return -1;
    }
    return probe(context, value) ? 1 : 0;
}

extern bool JSValueIsDate(void *, void *);
bool wr_is_date(void *context, void *value) {
    return JSValueIsDate(context, value);
}

void jsrt_request_worker_termination(void *group) {
    void (*request)(void *) = (void (*)(void *))dlsym(RTLD_DEFAULT, "JSRTRequestTermination");
    if (group && request) {
        request(group);
    }
}

bool jsrt_esm_available(void) {
    uint32_t (*version)(void) = (uint32_t (*)(void))dlsym(RTLD_DEFAULT, "JSRTModuleABIVersion");
    return version && version() == 1 && dlsym(RTLD_DEFAULT, "JSRTModuleInstall") &&
           dlsym(RTLD_DEFAULT, "JSRTModuleDispose") && dlsym(RTLD_DEFAULT, "JSRTModuleEvaluate") &&
           dlsym(RTLD_DEFAULT, "JSRTModuleCheck");
}

bool jsrt_esm_synthetic_available(void) {
    uint32_t (*version)(void) = (uint32_t (*)(void))dlsym(RTLD_DEFAULT, "JSRTSyntheticABIVersion");
    return jsrt_esm_available() && version && version() == 1 &&
           dlsym(RTLD_DEFAULT, "JSRTModuleInstallV2");
}

bool jsrt_esm_install(void *context, jsrt_module_resolve_fn resolve, jsrt_module_fetch_fn fetch,
                      jsrt_module_meta_fn meta, jsrt_module_value_fn value) {
    if (jsrt_esm_synthetic_available()) {
        bool (*install)(void *, jsrt_module_resolve_fn, jsrt_module_fetch_fn, jsrt_module_meta_fn,
                        jsrt_module_value_fn) =
            (bool (*)(void *, jsrt_module_resolve_fn, jsrt_module_fetch_fn, jsrt_module_meta_fn,
                      jsrt_module_value_fn))dlsym(RTLD_DEFAULT, "JSRTModuleInstallV2");
        return install(context, resolve, fetch, meta, value);
    }
    bool (*install)(void *, jsrt_module_resolve_fn, jsrt_module_fetch_fn, jsrt_module_meta_fn) =
        (bool (*)(void *, jsrt_module_resolve_fn, jsrt_module_fetch_fn, jsrt_module_meta_fn))dlsym(
            RTLD_DEFAULT, "JSRTModuleInstall");
    return jsrt_esm_available() && install(context, resolve, fetch, meta);
}

void jsrt_esm_dispose(void *context) {
    void (*dispose)(void *) = (void (*)(void *))dlsym(RTLD_DEFAULT, "JSRTModuleDispose");
    if (dispose)
        dispose(context);
}

void *jsrt_esm_evaluate(void *context, void *key, void **exception) {
    void *(*evaluate)(void *, void *, void **) =
        (void *(*)(void *, void *, void **))dlsym(RTLD_DEFAULT, "JSRTModuleEvaluate");
    return evaluate ? evaluate(context, key, exception) : NULL;
}

bool jsrt_esm_check(void *context, void *source, void *key, void **exception) {
    bool (*check)(void *, void *, void *, void **) =
        (bool (*)(void *, void *, void *, void **))dlsym(RTLD_DEFAULT, "JSRTModuleCheck");
    return check && check(context, source, key, exception);
}
static _Thread_local void *active_context;
void *wr_active_context(void) {
    return active_context;
}
void wr_bind_context(void *context) {
    active_context = context;
}
// JavaScriptCore ABI adaptation only. Host policy is implemented in Wave.
extern void *JSGlobalContextCreate(void *global_class);
extern const unsigned char kJSClassDefinitionEmpty[];
extern void *JSClassCreate(const void *);
extern void JSClassRelease(void *);
void *wr_context_create(void *global_class) {
    if (global_class) {
        active_context = JSGlobalContextCreate(global_class);
        return active_context;
    }
    void *klass = JSClassCreate(kJSClassDefinitionEmpty);
    if (!klass)
        return NULL;
    void *context = JSGlobalContextCreate(klass);
    JSClassRelease(klass);
    active_context = context;
    return context;
}
extern void JSGlobalContextRelease(void *context);
extern void jsrt_addon_stop(void *context);
extern void jsrt_addon_context_disposed(void *context);
void wr_context_release(void *context) {
    jsrt_addon_stop(context);
    JSGlobalContextRelease(context);
    jsrt_addon_context_disposed(context);
    if (active_context == context)
        active_context = NULL;
}
extern void *JSContextGetGlobalObject(void *context);
void *wr_context_global(void *context) {
    return JSContextGetGlobalObject(context);
}
extern void *JSObjectGetPrivate(void *);
extern bool JSObjectSetPrivate(void *, void *);
void *wr_context_data(void *context) {
    return JSObjectGetPrivate(JSContextGetGlobalObject(context));
}
bool wr_context_set_data(void *context, void *data) {
    return JSObjectSetPrivate(JSContextGetGlobalObject(context), data);
}
extern void *JSStringCreateWithUTF8CString(const char *text);
void *wr_string_utf8(const char *text) {
    return JSStringCreateWithUTF8CString(text);
}
extern void JSStringRelease(void *text);
void wr_string_release(void *text) {
    JSStringRelease(text);
}
extern int64_t JSStringGetMaximumUTF8CStringSize(void *text);
int64_t wr_string_utf8_capacity(void *text) {
    return JSStringGetMaximumUTF8CStringSize(text);
}
extern int64_t JSStringGetUTF8CString(void *text, void *output, int64_t capacity);
int64_t wr_string_copy_utf8(void *text, void *output, int64_t capacity) {
    return JSStringGetUTF8CString(text, output, capacity);
}
extern void *JSEvaluateScript(void *context, void *source, void *this_object, void *url,
                              int32_t line, void **exception);
extern void *JSObjectCallAsFunction(void *, void *, void *, int64_t, void **, void **);
extern void *JSObjectCallAsConstructor(void *, void *, int64_t, void **, void **);
extern void *JSObjectMakeFunctionWithCallback(void *, void *, void *);
extern bool jsrt_next_tick_ready(void *);
extern bool jsrt_next_tick_pending(void *);
extern void jsrt_drain_next_ticks(void *, void **);

enum entry_kind { ENTRY_EVALUATE, ENTRY_CALL, ENTRY_CONSTRUCT, ENTRY_CHECKPOINT };
struct engine_entry {
    enum entry_kind kind;
    void *context;
    void *target;
    void *receiver;
    void *url;
    int32_t line;
    int64_t count;
    void **args;
    void *gate;
    bool executing;
    struct engine_entry *previous;
};
static _Thread_local struct engine_entry *current_entry;

/* Linux JSC defers its Promise checkpoint across a native callback entry.
 * Wave drains nextTick callbacks inside that entry; JSC alone then drains jobs.
 * No source wrapper or replacement Promise queue is involved. */
static void *run_engine_entry(void *context, void *function, void *receiver, int64_t count,
                              void **args, void **exception) {
    (void)receiver;
    (void)count;
    (void)args;
    struct engine_entry *entry = current_entry;
    if (!entry || entry->context != context || entry->gate != function || entry->executing) {
        return wr_undefined(context);
    }
    entry->executing = true;
    void *result = wr_undefined(context);
    if (entry->kind == ENTRY_EVALUATE) {
        result = JSEvaluateScript(context, entry->target, entry->receiver, entry->url, entry->line,
                                  exception);
    } else if (entry->kind == ENTRY_CALL) {
        result = JSObjectCallAsFunction(context, entry->target, entry->receiver, entry->count,
                                        entry->args, exception);
    } else if (entry->kind == ENTRY_CONSTRUCT) {
        result =
            JSObjectCallAsConstructor(context, entry->target, entry->count, entry->args, exception);
    }
    if (result) {
        wr_protect(context, result);
    }
    if (!*exception) {
        jsrt_drain_next_ticks(context, exception);
    }
    if (result) {
        wr_unprotect(context, result);
    }
    entry->executing = false;
    return result ? result : wr_undefined(context);
}

static void *enter_engine(struct engine_entry *entry, void **exception) {
    entry->previous = current_entry;
    current_entry = entry;
    void *gate = JSObjectMakeFunctionWithCallback(entry->context, NULL, (void *)run_engine_entry);
    entry->gate = gate;
    wr_protect(entry->context, gate);
    void *result = JSObjectCallAsFunction(entry->context, gate, NULL, 0, NULL, exception);
    if (result) {
        wr_protect(entry->context, result);
    }
    /* Ticks scheduled from Promise jobs run after that complete checkpoint,
     * before returning control to host I/O or the next timer. */
    while (!*exception && jsrt_next_tick_pending(entry->context)) {
        entry->kind = ENTRY_CHECKPOINT;
        JSObjectCallAsFunction(entry->context, gate, NULL, 0, NULL, exception);
    }
    if (result) {
        wr_unprotect(entry->context, result);
    }
    wr_unprotect(entry->context, gate);
    current_entry = entry->previous;
    return result;
}

void wr_checkpoint(void *context, void **exception) {
    if (!*exception && jsrt_next_tick_pending(context)) {
        void *previous = active_context;
        active_context = context;
        struct engine_entry entry = {.kind = ENTRY_CHECKPOINT, .context = context};
        enter_engine(&entry, exception);
        active_context = previous;
    }
}

void *wr_evaluate(void *context, void *source, void *this_object, void *url, int32_t line,
                  void **exception) {
    void *previous = active_context;
    active_context = context;
    void *result;
    if (exception && jsrt_next_tick_ready(context) &&
        (!current_entry || current_entry->context != context)) {
        struct engine_entry entry = {.kind = ENTRY_EVALUATE,
                                     .context = context,
                                     .target = source,
                                     .receiver = this_object,
                                     .url = url,
                                     .line = line};
        result = enter_engine(&entry, exception);
    } else {
        result = JSEvaluateScript(context, source, this_object, url, line, exception);
    }
    active_context = previous;
    return result;
}
extern void *JSValueToStringCopy(void *context, void *value, void **exception);
void *wr_to_string(void *context, void *value, void **exception) {
    return JSValueToStringCopy(context, value, exception);
}
extern void *JSValueMakeUndefined(void *context);
void *wr_undefined(void *context) {
    return JSValueMakeUndefined(context);
}
extern void *JSValueMakeString(void *context, void *text);
void *wr_string_value(void *context, void *text) {
    return JSValueMakeString(context, text);
}
extern bool JSValueIsObject(void *context, void *value);
bool wr_is_object(void *context, void *value) {
    return JSValueIsObject(context, value);
}
extern bool JSValueIsUndefined(void *context, void *value);
bool wr_is_undefined(void *context, void *value) {
    return JSValueIsUndefined(context, value);
}
extern void JSValueProtect(void *context, void *value);
void wr_protect(void *context, void *value) {
    JSValueProtect(context, value);
}
extern void JSValueUnprotect(void *context, void *value);
void wr_unprotect(void *context, void *value) {
    JSValueUnprotect(context, value);
}
extern void *JSObjectMake(void *context, void *js_class, void *data);
void *wr_object(void *context, void *js_class, void *data) {
    return JSObjectMake(context, js_class, data);
}
extern void *JSObjectMakeFunctionWithCallback(void *context, void *name, void *callback);
void *wr_function(void *context, void *name, void *callback) {
    return JSObjectMakeFunctionWithCallback(context, name, callback);
}
extern void *JSObjectMakeFunction(void *context, void *name, uint32_t count, void **parameters,
                                  void *body, void *url, int32_t line, void **exception);
void *wr_compile_function(void *context, void *name, uint32_t count, void **parameters, void *body,
                          void *url, int32_t line, void **exception) {
    return JSObjectMakeFunction(context, name, count, parameters, body, url, line, exception);
}
extern void *JSObjectMakeDeferredPromise(void *context, void **resolve, void **reject,
                                         void **exception);
void *wr_promise(void *context, void **resolve, void **reject, void **exception) {
    return JSObjectMakeDeferredPromise(context, resolve, reject, exception);
}
// Exported WebKit SPI, documented in JSContextRefPrivate.h. A callable is required.
extern void JSGlobalContextSetUnhandledRejectionCallback(void *context, void *function,
                                                         void **exception);
void wr_rejection_handler(void *context, void *function, void **exception) {
    JSGlobalContextSetUnhandledRejectionCallback(context, function, exception);
}
extern void JSObjectSetProperty(void *context, void *object, void *name, void *value,
                                uint32_t attributes, void **exception);
void wr_set(void *context, void *object, void *name, void *value, uint32_t attributes,
            void **exception) {
    JSObjectSetProperty(context, object, name, value, attributes, exception);
}
extern void *JSObjectGetProperty(void *context, void *object, void *name, void **exception);
void *wr_get(void *context, void *object, void *name, void **exception) {
    return JSObjectGetProperty(context, object, name, exception);
}
extern void *JSValueMakeNumber(void *context, double value);
void *wr_number(void *context, double value) {
    return JSValueMakeNumber(context, value);
}
extern double JSValueToNumber(void *context, void *value, void **exception);
double wr_to_number(void *context, void *value, void **exception) {
    return JSValueToNumber(context, value, exception);
}
extern bool JSObjectIsFunction(void *context, void *object);
bool wr_callable(void *context, void *object) {
    return object && JSValueIsObject(context, object) && JSObjectIsFunction(context, object);
}
extern void *JSObjectCallAsFunction(void *context, void *function, void *this_object, int64_t count,
                                    void **args, void **exception);
void *wr_call(void *context, void *function, void *this_object, int64_t count, void **args,
              void **exception) {
    void *previous = active_context;
    active_context = context;
    void *result;
    if (exception && jsrt_next_tick_ready(context) &&
        (!current_entry || current_entry->context != context)) {
        struct engine_entry entry = {.kind = ENTRY_CALL,
                                     .context = context,
                                     .target = function,
                                     .receiver = this_object,
                                     .count = count,
                                     .args = args};
        result = enter_engine(&entry, exception);
    } else {
        result = JSObjectCallAsFunction(context, function, this_object, count, args, exception);
    }
    active_context = previous;
    return result;
}
extern void *JSObjectCallAsConstructor(void *context, void *constructor, int64_t count, void **args,
                                       void **exception);
void *wr_construct(void *context, void *constructor, int64_t count, void **args, void **exception) {
    void *previous = active_context;
    active_context = context;
    void *result;
    if (exception && jsrt_next_tick_ready(context) &&
        (!current_entry || current_entry->context != context)) {
        struct engine_entry entry = {.kind = ENTRY_CONSTRUCT,
                                     .context = context,
                                     .target = constructor,
                                     .count = count,
                                     .args = args};
        result = enter_engine(&entry, exception);
    } else {
        result = JSObjectCallAsConstructor(context, constructor, count, args, exception);
    }
    active_context = previous;
    return result;
}
extern int32_t JSValueGetType(void *ctx, void *value);
int32_t wr_type(void *ctx, void *value) {
    return JSValueGetType(ctx, value);
}
extern void *JSValueMakeNull(void *ctx);
void *wr_null(void *ctx) {
    return JSValueMakeNull(ctx);
}
extern void *JSValueMakeBoolean(void *ctx, bool value);
void *wr_boolean(void *ctx, bool value) {
    return JSValueMakeBoolean(ctx, value);
}
extern bool JSValueToBoolean(void *ctx, void *value);
bool wr_to_boolean(void *ctx, void *value) {
    return JSValueToBoolean(ctx, value);
}
extern void *JSValueToObject(void *ctx, void *value, void **ex);
void *wr_to_object(void *ctx, void *value, void **ex) {
    return JSValueToObject(ctx, value, ex);
}
extern bool JSValueIsStrictEqual(void *ctx, void *a, void *b);
bool wr_equal(void *ctx, void *a, void *b) {
    return JSValueIsStrictEqual(ctx, a, b);
}
extern void *JSStringCreateWithCharacters(uint16_t *text, int64_t length);
void *wr_string_utf16(uint16_t *text, int64_t length) {
    return JSStringCreateWithCharacters(text, length);
}
extern uint16_t *JSStringGetCharactersPtr(void *text);
uint16_t *wr_string_characters(void *text) {
    return JSStringGetCharactersPtr(text);
}
extern int64_t JSStringGetLength(void *text);
int64_t wr_string_length(void *text) {
    return JSStringGetLength(text);
}
extern bool JSStringIsEqual(void *a, void *b);
bool wr_string_equal(void *a, void *b) {
    return JSStringIsEqual(a, b);
}
extern void *JSObjectMakeArray(void *ctx, int64_t length, void **values, void **ex);
void *wr_array(void *ctx, int64_t length, void **values, void **ex) {
    return JSObjectMakeArray(ctx, length, values, ex);
}
extern void *JSObjectGetPrototype(void *ctx, void *object);
void *wr_get_prototype(void *ctx, void *object) {
    return JSObjectGetPrototype(ctx, object);
}
extern void JSObjectSetPrototype(void *ctx, void *object, void *value);
void wr_set_prototype(void *ctx, void *object, void *value) {
    JSObjectSetPrototype(ctx, object, value);
}
extern bool JSObjectDeleteProperty(void *ctx, void *obj, void *key, void **ex);
bool wr_delete(void *ctx, void *obj, void *key, void **ex) {
    return JSObjectDeleteProperty(ctx, obj, key, ex);
}
extern bool JSObjectHasProperty(void *ctx, void *obj, void *key);
bool wr_has(void *ctx, void *obj, void *key) {
    return JSObjectHasProperty(ctx, obj, key);
}
extern void *JSObjectGetPropertyAtIndex(void *ctx, void *obj, uint32_t index, void **ex);
void *wr_get_index(void *ctx, void *obj, uint32_t index, void **ex) {
    return JSObjectGetPropertyAtIndex(ctx, obj, index, ex);
}
extern void JSObjectSetPropertyAtIndex(void *ctx, void *obj, uint32_t index, void *value,
                                       void **ex);
void wr_set_index(void *ctx, void *obj, uint32_t index, void *value, void **ex) {
    JSObjectSetPropertyAtIndex(ctx, obj, index, value, ex);
}
extern uint32_t jsc_get_major_version(void), jsc_get_minor_version(void),
    jsc_get_micro_version(void);
const char *wr_engine_name(void) {
    return "JavaScriptCoreGTK";
}
const char *wr_engine_version(void) {
    static _Thread_local char version[48];
    snprintf(version, sizeof(version), "%u.%u.%u", jsc_get_major_version(), jsc_get_minor_version(),
             jsc_get_micro_version());
    return version;
}
uint32_t wr_engine_major(void) {
    return jsc_get_major_version();
}
uint32_t wr_engine_minor(void) {
    return jsc_get_minor_version();
}
uint32_t wr_engine_micro(void) {
    return jsc_get_micro_version();
}
uint32_t wr_engine_patch(void) {
    return 0;
}
extern void *JSObjectMakeConstructor(void *, void *, void *);
extern const unsigned char kJSClassDefinitionEmpty[];
extern void *JSClassCreate(const void *);
extern void JSClassRelease(void *);
void *wr_constructor(void *ctx, void *callback) {
    void *klass = JSClassCreate(kJSClassDefinitionEmpty);
    void *result = JSObjectMakeConstructor(ctx, klass, callback);
    JSClassRelease(klass);
    return result;
}
extern bool JSValueIsArray(void *, void *);
bool wr_is_array(void *ctx, void *value) {
    return JSValueIsArray(ctx, value);
}
extern int32_t JSValueGetTypedArrayType(void *, void *, void **);
int32_t wr_typed_type(void *ctx, void *value, void **ex) {
    return JSValueGetTypedArrayType(ctx, value, ex);
}
extern void *JSObjectMakeTypedArray(void *, int32_t, int64_t, void **);
void *wr_u8_new(void *ctx, int64_t length, void **ex) {
    return JSObjectMakeTypedArray(ctx, 3, length, ex);
}
extern void *JSObjectMakeTypedArrayWithArrayBufferAndOffset(void *, int32_t, void *, int64_t,
                                                            int64_t, void **);
void *wr_u8_view(void *ctx, void *buffer, int64_t offset, int64_t length, void **ex) {
    return JSObjectMakeTypedArrayWithArrayBufferAndOffset(ctx, 3, buffer, offset, length, ex);
}
extern void *JSObjectGetTypedArrayBuffer(void *, void *, void **);
void *wr_typed_buffer(void *ctx, void *value, void **ex) {
    return JSObjectGetTypedArrayBuffer(ctx, value, ex);
}
extern int64_t JSObjectGetTypedArrayByteLength(void *, void *, void **);
int64_t wr_typed_length(void *ctx, void *value, void **ex) {
    return JSObjectGetTypedArrayByteLength(ctx, value, ex);
}
extern int64_t JSObjectGetTypedArrayByteOffset(void *, void *, void **);
int64_t wr_typed_offset(void *ctx, void *value, void **ex) {
    return JSObjectGetTypedArrayByteOffset(ctx, value, ex);
}
extern void *JSObjectGetTypedArrayBytesPtr(void *, void *, void **);
void *wr_typed_bytes(void *ctx, void *value, void **ex) {
    return JSObjectGetTypedArrayBytesPtr(ctx, value, ex);
}
extern int64_t JSObjectGetArrayBufferByteLength(void *, void *, void **);
int64_t wr_array_buffer_length(void *ctx, void *value, void **ex) {
    return JSObjectGetArrayBufferByteLength(ctx, value, ex);
}
typedef void (*BufferDeallocator)(void *, void *);
extern void *JSObjectMakeArrayBufferWithBytesNoCopy(void *, void *, size_t, BufferDeallocator,
                                                    void *, void **);
extern void *JSObjectGetArrayBufferBytesPtr(void *, void *, void **);
void *wr_external_buffer(void *ctx, void *bytes, int64_t length, void *deallocator, void **ex) {
    return JSObjectMakeArrayBufferWithBytesNoCopy(ctx, bytes, (size_t)length,
                                                  (BufferDeallocator)deallocator, NULL, ex);
}
void *wr_array_buffer_bytes(void *ctx, void *value, void **ex) {
    return JSObjectGetArrayBufferBytesPtr(ctx, value, ex);
}
