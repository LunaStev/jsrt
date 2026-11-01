#ifndef JSRT_MODULES_H
#define JSRT_MODULES_H

#include <stdbool.h>
#include <stdint.h>

/* C boundary compiled into the same JavaScriptCore build as its private headers.
 * Callbacks execute synchronously on the context owner. Returned source/key
 * strings are owned JSStringRefs, consumed and released by the engine adapter. */
typedef void *(*jsrt_module_resolve_fn)(void *, void *, void *, void **);
typedef void *(*jsrt_module_fetch_fn)(void *, void *, void **);
typedef void *(*jsrt_module_meta_fn)(void *, void *, void **);
typedef void *(*jsrt_module_value_fn)(void *, void *, int32_t, void **);

#ifdef __cplusplus
extern "C" {
#endif

uint32_t JSRTModuleABIVersion(void);
bool JSRTModuleInstall(void *, jsrt_module_resolve_fn, jsrt_module_fetch_fn, jsrt_module_meta_fn);
bool JSRTModuleInstallV2(void *, jsrt_module_resolve_fn, jsrt_module_fetch_fn, jsrt_module_meta_fn,
                         jsrt_module_value_fn);
uint32_t JSRTSyntheticABIVersion(void);
void JSRTModuleDispose(void *);
void *JSRTModuleEvaluate(void *, void *, void **);
bool JSRTModuleCheck(void *, void *, void *, void **);
void JSRTRequestTermination(void *);
bool JSRTPrepareWorkerTermination(void *);
uint32_t JSRTWorkerABIVersion(void);
void JSRTDrainOwnerRunLoop(void);
uint32_t JSRTCloneABIVersion(void);
bool JSRTIsProxy(void *, void *);
void *JSRTMakeConstructor(void *, void *, void *);

#ifdef __cplusplus
}
#endif

#endif
