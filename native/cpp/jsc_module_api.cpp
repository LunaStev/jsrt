// Built inside JSC, never against an unrelated installed private-header layout.
// Paths, source loading, import.meta properties and resource limits stay in Wave.
#include "config.h"
#include "../include/jsrt_modules.h"

#include "APICast.h"
#include "Completion.h"
#include "GlobalObjectMethodTable.h"
#include "FunctionPrototype.h"
#include "JSCInlines.h"
#include "JSContextRef.h"
#include "JSLock.h"
#include "JSModuleLoader.h"
#include "JSModuleRecord.h"
#include "JSObjectRef.h"
#include "JSPromise.h"
#include "JSSourceCode.h"
#include "JSStringRef.h"
#include "OpaqueJSString.h"
#include "ParserError.h"
#include "ProxyObject.h"
#include "SourceCode.h"
#include "SourceOrigin.h"
#include "SyntheticModuleRecord.h"
#include "ThrowScope.h"
#include <wtf/URL.h>
#include <wtf/RunLoop.h>

using namespace JSC;

namespace {
bool constructorHasInstance(JSContextRef context, JSObjectRef constructor, JSValueRef value,
                            JSValueRef *exception) {
    auto *global = toJS(context);
    auto &vm = global->vm();
    JSLockHolder lock(vm);
    auto scope = DECLARE_THROW_SCOPE(vm);
    JSValue prototype = toJS(constructor)->get(global, vm.propertyNames->prototype);
    bool result = false;
    if (!scope.exception()) {
        result = JSObject::defaultHasInstance(global, toJS(global, value), prototype);
    }
    if (scope.exception()) {
        *exception = toRef(global, scope.exception()->value());
        (void)scope.tryClearException();
    }
    return result;
}

struct ModuleHooks {
    GlobalObjectMethodTable table;
    const GlobalObjectMethodTable *original;
    jsrt_module_resolve_fn resolve;
    jsrt_module_fetch_fn fetch;
    jsrt_module_meta_fn meta;
    jsrt_module_value_fn value;
};

ModuleHooks &hooks(JSGlobalObject *global) {
    return *static_cast<ModuleHooks *>(global->runtimeModuleHooks());
}

void propagate(JSGlobalObject *global, void *exception) {
    if (exception) {
        auto scope = DECLARE_THROW_SCOPE(global->vm());
        throwException(global, scope, toJS(global, static_cast<JSValueRef>(exception)));
    }
}

Identifier resolveModule(JSGlobalObject *global, JSModuleLoader *, JSValue name, JSValue referrer,
                         RefPtr<ScriptFetcher>, bool) {
    auto scope = DECLARE_THROW_SCOPE(global->vm());
    void *exception = nullptr;
    auto result = static_cast<JSStringRef>(hooks(global).resolve(
        toGlobalRef(global), const_cast<void *>(static_cast<const void *>(toRef(global, name))),
        const_cast<void *>(static_cast<const void *>(toRef(global, referrer))), &exception));
    propagate(global, exception);
    if (!result) {
        if (!scope.exception())
            throwTypeError(global, scope, "Module resolution failed"_s);
        return {};
    }
    auto key = Identifier::fromString(global->vm(), result->string());
    JSStringRelease(result);
    return key;
}

JSPromise *fetchModule(JSGlobalObject *global, JSModuleLoader *, JSValue key,
                       RefPtr<ScriptFetchParameters> parameters, RefPtr<ScriptFetcher>) {
    auto &vm = global->vm();
    auto scope = DECLARE_THROW_SCOPE(vm);
    auto *promise = JSPromise::create(vm, global->promiseStructure());
    if (hooks(global).value) {
        void *exception = nullptr;
        int32_t type = parameters ? static_cast<int32_t>(parameters->type())
                                  : static_cast<int32_t>(ScriptFetchParameters::JavaScript);
        void *descriptor = hooks(global).value(
            toGlobalRef(global), const_cast<void *>(static_cast<const void *>(toRef(global, key))),
            type, &exception);
        propagate(global, exception);
        RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
        if (!descriptor) {
            throwTypeError(global, scope, "Invalid host module descriptor"_s);
            return promise->rejectWithCaughtException(vm, scope);
        }
        JSValue value = toJS(global, static_cast<JSValueRef>(descriptor));
        if (!value.isUndefined()) {
            auto *record = dynamicDowncast<JSObject>(value);
            if (!record) {
                throwTypeError(global, scope, "Invalid host module descriptor"_s);
                return promise->rejectWithCaughtException(vm, scope);
            }
            Strong<JSObject> root(vm, record);
            JSValue namesValue = record->get(global, Identifier::fromString(vm, "names"_s));
            RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
            JSValue valuesValue = record->get(global, Identifier::fromString(vm, "values"_s));
            RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
            auto *names = dynamicDowncast<JSArray>(namesValue);
            auto *values = dynamicDowncast<JSArray>(valuesValue);
            if (!names || !values || names->length() != values->length()) {
                throwTypeError(global, scope, "Invalid host export arrays"_s);
                return promise->rejectWithCaughtException(vm, scope);
            }
            Vector<Identifier, 4> exportNames;
            MarkedArgumentBuffer exportValues;
            for (unsigned index = 0; index < names->length(); ++index) {
                JSValue name = names->getIndex(global, index);
                RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
                if (!name.isString()) {
                    throwTypeError(global, scope, "Invalid host export name"_s);
                    return promise->rejectWithCaughtException(vm, scope);
                }
                exportNames.append(Identifier::fromString(vm, asString(name)->value(global)));
                RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
                exportValues.appendWithCrashOnOverflow(values->getIndex(global, index));
                RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
            }
            auto moduleKey = Identifier::fromString(vm, key.toWTFString(global));
            RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
            auto *module = SyntheticModuleRecord::tryCreateWithExportNamesAndValues(
                global, moduleKey, exportNames, exportValues);
            RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
            Strong<SyntheticModuleRecord> moduleRoot(vm, module);
            JSValue evaluator = record->get(global, Identifier::fromString(vm, "evaluate"_s));
            RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
            if (!evaluator.isUndefined()) {
                auto *function = dynamicDowncast<JSObject>(evaluator);
                if (!function || getCallData(function).type == CallData::Type::None) {
                    throwTypeError(global, scope, "Invalid host value evaluator"_s);
                    return promise->rejectWithCaughtException(vm, scope);
                }
                module->setRuntimeValueEvaluator(vm, function);
            }
            scope.release();
            promise->fulfill(vm, module);
            return promise;
        }
    }
    if (parameters && parameters->type() != ScriptFetchParameters::Type::JavaScript &&
        parameters->type() != ScriptFetchParameters::Type::None) {
        throwTypeError(global, scope, "Only JavaScript ESM sources are supported"_s);
        return promise->rejectWithCaughtException(vm, scope);
    }
    void *exception = nullptr;
    auto source = static_cast<JSStringRef>(hooks(global).fetch(
        toGlobalRef(global), const_cast<void *>(static_cast<const void *>(toRef(global, key))),
        &exception));
    propagate(global, exception);
    if (!source) {
        if (!scope.exception())
            throwTypeError(global, scope, "Module source loading failed"_s);
        return promise->rejectWithCaughtException(vm, scope);
    }
    auto text = source->string();
    JSStringRelease(source);
    auto path = key.toWTFString(global);
    RETURN_IF_EXCEPTION(scope, promise->rejectWithCaughtException(vm, scope));
    auto origin = SourceOrigin{URL::fileURLWithFileSystemPath(path)};
    auto code = makeSource(text, origin, SourceTaintedOrigin::Untainted, path, TextPosition(),
                           SourceProviderSourceType::Module);
    auto *wrapped = JSSourceCode::create(vm, WTF::move(code));
    scope.release();
    promise->resolve(global, vm, wrapped);
    return promise;
}

JSPromise *importModuleDynamically(JSGlobalObject *global, JSModuleLoader *, JSString *name,
                                   RefPtr<ScriptFetchParameters> parameters,
                                   const SourceOrigin &origin, bool deferred) {
    auto &vm = global->vm();
    auto scope = DECLARE_THROW_SCOPE(vm);
    auto specifier = name->value(global);
    if (scope.exception())
        return JSPromise::create(vm, global->promiseStructure())
            ->rejectWithCaughtException(vm, scope);
    auto referrer = Identifier::fromString(
        vm, origin.url().isValid() && origin.url().protocolIsFile() ? origin.url().fileSystemPath()
                                                                    : "<eval>"_s);
    auto *result = JSC::importModule(global, Identifier::fromString(vm, specifier), referrer,
                                     WTF::move(parameters), nullptr, deferred);
    if (scope.exception())
        return JSPromise::create(vm, global->promiseStructure())
            ->rejectWithCaughtException(vm, scope);
    return result;
}

JSObject *createMeta(JSGlobalObject *global, JSModuleLoader *, JSValue key, JSModuleRecord *,
                     RefPtr<ScriptFetcher>) {
    void *exception = nullptr;
    auto result = hooks(global).meta(
        toGlobalRef(global), const_cast<void *>(static_cast<const void *>(toRef(global, key))),
        &exception);
    propagate(global, exception);
    return result ? toJS(static_cast<JSObjectRef>(result)) : nullptr;
}
} // namespace

extern "C" JS_EXPORT uint32_t JSRTModuleABIVersion() {
    return 1;
}

extern "C" JS_EXPORT bool JSRTModuleInstall(void *context, jsrt_module_resolve_fn resolve,
                                            jsrt_module_fetch_fn fetch, jsrt_module_meta_fn meta) {
    auto *global = toJS(static_cast<JSGlobalContextRef>(context));
    JSLockHolder lock(global);
    if (!resolve || !fetch || !meta || global->runtimeModuleHooks())
        return false;
    auto *record = new ModuleHooks{*global->globalObjectMethodTable(),
                                   global->globalObjectMethodTable(),
                                   resolve,
                                   fetch,
                                   meta,
                                   nullptr};
    record->table.moduleLoaderResolve = resolveModule;
    record->table.moduleLoaderFetch = fetchModule;
    record->table.moduleLoaderImportModule = importModuleDynamically;
    record->table.moduleLoaderCreateImportMetaProperties = createMeta;
    global->setRuntimeModuleHooks(record, &record->table);
    return true;
}

extern "C" JS_EXPORT uint32_t JSRTSyntheticABIVersion() {
    return 1;
}

extern "C" JS_EXPORT bool JSRTModuleInstallV2(void *context, jsrt_module_resolve_fn resolve,
                                              jsrt_module_fetch_fn fetch, jsrt_module_meta_fn meta,
                                              jsrt_module_value_fn value) {
    if (!value || !JSRTModuleInstall(context, resolve, fetch, meta)) {
        return false;
    }
    auto *global = toJS(static_cast<JSGlobalContextRef>(context));
    JSLockHolder lock(global);
    hooks(global).value = value;
    return true;
}

extern "C" JS_EXPORT void JSRTModuleDispose(void *context) {
    auto *global = toJS(static_cast<JSGlobalContextRef>(context));
    JSLockHolder lock(global);
    auto *record = static_cast<ModuleHooks *>(global->runtimeModuleHooks());
    if (!record)
        return;
    global->setRuntimeModuleHooks(nullptr, record->original);
    delete record;
}

extern "C" JS_EXPORT void *JSRTModuleEvaluate(void *context, void *key, void **exception) {
    auto *global = toJS(static_cast<JSGlobalContextRef>(context));
    JSLockHolder lock(global);
    auto scope = DECLARE_THROW_SCOPE(global->vm());
    auto *promise = JSC::loadAndEvaluateModule(global, static_cast<JSStringRef>(key)->string(),
                                               nullptr, nullptr);
    if (scope.exception()) {
        *exception = const_cast<void *>(
            static_cast<const void *>(toRef(global, scope.exception()->value())));
        (void)scope.tryClearException();
        return nullptr;
    }
    return const_cast<void *>(static_cast<const void *>(toRef(global, promise)));
}

extern "C" JS_EXPORT bool JSRTModuleCheck(void *context, void *source, void *key,
                                          void **exception) {
    auto *global = toJS(static_cast<JSGlobalContextRef>(context));
    JSLockHolder lock(global);
    auto scope = DECLARE_THROW_SCOPE(global->vm());
    auto path = static_cast<JSStringRef>(key)->string();
    auto code = makeSource(static_cast<JSStringRef>(source)->string(),
                           SourceOrigin{URL::fileURLWithFileSystemPath(path)},
                           SourceTaintedOrigin::Untainted, path, TextPosition(),
                           SourceProviderSourceType::Module);
    ParserError error;
    bool valid = checkModuleSyntax(global, code, error);
    if (scope.exception()) {
        *exception = const_cast<void *>(
            static_cast<const void *>(toRef(global, scope.exception()->value())));
        (void)scope.tryClearException();
    } else if (!valid) {
        *exception = toRef(error.toErrorObject(global, code));
    }
    return valid && !*exception;
}

// Caller must retain the context group across this concurrent request and join
// the owning thread before releasing it. No deadline or CPU budget is installed.
// Preparation happens on the owner before a concurrent request is possible.
extern "C" JS_EXPORT bool JSRTPrepareWorkerTermination(void *group) {
    if (!group) {
        return false;
    }
    auto *vm = toJS(static_cast<JSContextGroupRef>(group));
    JSLockHolder lock(vm);
    // The stable C evaluate API does not enforce this worker entry policy.
    // Wave must prepare every entry and stop dispatch when preparation refuses.
    if (vm->executionForbidden()) {
        return false;
    }
    vm->ensureTerminationException();
    vm->forbidExecutionOnTermination();
    return true;
}

extern "C" JS_EXPORT uint32_t JSRTWorkerABIVersion() {
    return 2;
}

extern "C" JS_EXPORT void JSRTDrainOwnerRunLoop() {
    // VM teardown dispatches timer disposal to its creation run loop. Wave calls
    // this nonblocking cycle after the last VM release on a dedicated Worker.
    WTF::RunLoop::cycle();
}

extern "C" JS_EXPORT uint32_t JSRTCloneABIVersion() {
    return 1;
}

extern "C" JS_EXPORT bool JSRTIsProxy(void *context, void *value) {
    auto *global = toJS(static_cast<JSContextRef>(context));
    JSLockHolder lock(global->vm());
    JSValue candidate = toJS(global, static_cast<JSValueRef>(value));
    return candidate.isCell() && candidate.inherits<ProxyObject>();
}

// A JSCallbackConstructor alone is not callable and reports typeof "object".
// Public class constructors must be callable (and throw in Wave without new).
extern "C" JS_EXPORT void *JSRTMakeConstructor(void *context, void *call, void *construct) {
    auto ctx = static_cast<JSContextRef>(context);
    auto *global = toJS(ctx);
    JSLockHolder lock(global->vm());
    JSClassDefinition definition = kJSClassDefinitionEmpty;
    definition.className = "Function";
    definition.callAsFunction = reinterpret_cast<JSObjectCallAsFunctionCallback>(call);
    definition.callAsConstructor = reinterpret_cast<JSObjectCallAsConstructorCallback>(construct);
    definition.hasInstance = constructorHasInstance;
    JSClassRef cls = JSClassCreate(&definition);
    JSObjectRef result = JSObjectMake(ctx, cls, nullptr);
    JSClassRelease(cls);
    JSValueProtect(ctx, result);
    JSObjectSetPrototype(ctx, result, toRef(global->functionPrototype()));
    JSObjectRef prototype = JSObjectMake(ctx, nullptr, nullptr);
    JSStringRef name = JSStringCreateWithUTF8CString("prototype");
    JSObjectSetProperty(ctx, result, name, prototype,
                        kJSPropertyAttributeDontEnum | kJSPropertyAttributeDontDelete |
                            kJSPropertyAttributeReadOnly,
                        nullptr);
    JSStringRelease(name);
    JSValueUnprotect(ctx, result);
    return result;
}

extern "C" JS_EXPORT void JSRTRequestTermination(void *group) {
    toJS(static_cast<JSContextGroupRef>(group))->notifyNeedTermination();
}

// Version identity of the upstream release used for this JSCOnly build.
extern "C" JS_EXPORT unsigned jsc_get_major_version() {
    return 2;
}
extern "C" JS_EXPORT unsigned jsc_get_minor_version() {
    return 54;
}
extern "C" JS_EXPORT unsigned jsc_get_micro_version() {
    return 1;
}
