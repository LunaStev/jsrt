/* Test-only pthread ABI. Every JSC context and its host state stay in Wave. */
#include <pthread.h>
#include <stdint.h>
#include <dlfcn.h>
#include <stdio.h>
#include "../native/c/engine.h"

/* Serial ABI probes transport opaque handles without entering a real VM. */
static uint32_t constructor_test_version;
static int constructor_version_calls;
static int constructor_factory_calls;
static int constructor_result_tag;
static void *constructor_seen_context;
static void *constructor_seen_call;
static void *constructor_seen_construct;

static uint32_t constructor_version_probe(void) {
    ++constructor_version_calls;
    return constructor_test_version;
}

static void *constructor_factory_probe(void *context, void *call, void *construct) {
    ++constructor_factory_calls;
    constructor_seen_context = context;
    constructor_seen_call = call;
    constructor_seen_construct = construct;
    return &constructor_result_tag;
}

static void *constructor_factory_null(void *context, void *call, void *construct) {
    (void)context;
    (void)call;
    (void)construct;
    ++constructor_factory_calls;
    return NULL;
}

int32_t jsrt_test_constructor_abi(void) {
    int context_tag;
    int call_tag;
    int construct_tag;
    void *context = &context_tag;
    void *call = &call_tag;
    void *construct = &construct_tag;
    const uint32_t unsupported[] = {0, 1, 3, UINT32_MAX};
    for (size_t i = 0; i < sizeof(unsupported) / sizeof(unsupported[0]); ++i) {
        constructor_test_version = unsupported[i];
        constructor_factory_calls = 0;
        if (jsrt_create_callable_constructor_with_abi(
                context, call, construct, constructor_version_probe, constructor_factory_probe) ||
            constructor_factory_calls) {
            return 0;
        }
    }
    constructor_test_version = 2;
    constructor_factory_calls = 0;
    constructor_version_calls = 0;
    if (jsrt_create_callable_constructor_with_abi(context, call, construct, NULL,
                                                  constructor_factory_probe) ||
        jsrt_create_callable_constructor_with_abi(context, call, construct,
                                                  constructor_version_probe, NULL) ||
        jsrt_create_callable_constructor_with_abi(NULL, call, construct, constructor_version_probe,
                                                  constructor_factory_probe) ||
        jsrt_create_callable_constructor_with_abi(
            context, NULL, construct, constructor_version_probe, constructor_factory_probe) ||
        jsrt_create_callable_constructor_with_abi(context, call, NULL, constructor_version_probe,
                                                  constructor_factory_probe) ||
        constructor_factory_calls || constructor_version_calls) {
        return 0;
    }
    if (jsrt_create_callable_constructor_with_abi(
            context, call, construct, constructor_version_probe, constructor_factory_probe) !=
            &constructor_result_tag ||
        constructor_factory_calls != 1 || constructor_version_calls != 1 ||
        constructor_seen_context != context || constructor_seen_call != call ||
        constructor_seen_construct != construct) {
        return 0;
    }
    constructor_factory_calls = 0;
    return !jsrt_create_callable_constructor_with_abi(
               context, call, construct, constructor_version_probe, constructor_factory_null) &&
           constructor_factory_calls == 1;
}

extern void jsrt_test_context_task(int32_t *result);

struct gate {
    pthread_mutex_t mutex;
    pthread_cond_t condition;
    int start;
};
struct task {
    struct gate *gate;
    int32_t result;
};
static void *run_task(void *argument) {
    struct task *task = argument;
    pthread_mutex_lock(&task->gate->mutex);
    while (!task->gate->start)
        pthread_cond_wait(&task->gate->condition, &task->gate->mutex);
    int ready = task->gate->start > 0;
    pthread_mutex_unlock(&task->gate->mutex);
    if (ready)
        jsrt_test_context_task(&task->result);
    return NULL;
}
int32_t jsrt_test_parallel_contexts(void) {
    struct gate gate = {PTHREAD_MUTEX_INITIALIZER, PTHREAD_COND_INITIALIZER, 0};
    struct task tasks[2] = {{&gate, 0}, {&gate, 0}};
    pthread_t threads[2];
    int count = 0;
    while (count < 2 && !pthread_create(&threads[count], NULL, run_task, &tasks[count]))
        ++count;
    pthread_mutex_lock(&gate.mutex);
    gate.start = count == 2 ? 1 : -1;
    pthread_cond_broadcast(&gate.condition);
    pthread_mutex_unlock(&gate.mutex);
    for (int i = 0; i < count; ++i) {
        /* Returning with stack storage still visible to a thread is unsafe. */
        if (pthread_join(threads[i], NULL))
            __builtin_trap();
    }
    pthread_cond_destroy(&gate.condition);
    pthread_mutex_destroy(&gate.mutex);
    return count == 2 && tasks[0].result == 1 && tasks[1].result == 1;
}

/* The Wave task owns its context. The gate transports a retained group for
 * the engine's concurrent termination request, never a JavaScript value. */
struct termination_task {
    pthread_mutex_t mutex;
    pthread_cond_t condition;
    void *group;
    int done;
    int32_t result;
};
extern void jsrt_test_termination_task(void *task, int32_t *result);
extern const void *jsrt_test_termination_ready(const void *, void *, void *, size_t, const void **,
                                               const void **);
extern void JSContextGroupRelease(void *);

void *jsrt_test_termination_callback(void) {
    return (void *)jsrt_test_termination_ready;
}

void jsrt_test_termination_phase(int32_t phase) {
    fprintf(stderr, "termination: owner phase %d\n", phase);
}

void jsrt_test_publish_termination_group(void *data, void *group) {
    fprintf(stderr, "termination: publishing group\n");
    struct termination_task *task = data;
    pthread_mutex_lock(&task->mutex);
    task->group = group;
    pthread_cond_broadcast(&task->condition);
    pthread_mutex_unlock(&task->mutex);
}

static void *run_termination_task(void *data) {
    struct termination_task *task = data;
    jsrt_test_termination_task(task, &task->result);
    pthread_mutex_lock(&task->mutex);
    task->done = 1;
    pthread_cond_broadcast(&task->condition);
    pthread_mutex_unlock(&task->mutex);
    return NULL;
}

int32_t jsrt_test_explicit_termination(void) {
    void (*request)(void *) = (void (*)(void *))dlsym(RTLD_DEFAULT, "JSRTRequestTermination");
    if (!request)
        return -1;
    struct termination_task task = {PTHREAD_MUTEX_INITIALIZER, PTHREAD_COND_INITIALIZER, NULL, 0,
                                    0};
    pthread_t thread;
    if (pthread_create(&thread, NULL, run_termination_task, &task)) {
        pthread_cond_destroy(&task.condition);
        pthread_mutex_destroy(&task.mutex);
        return 0;
    }
    pthread_mutex_lock(&task.mutex);
    while (!task.group && !task.done)
        pthread_cond_wait(&task.condition, &task.mutex);
    void *group = task.group;
    pthread_mutex_unlock(&task.mutex);
    if (group)
        request(group);
    fprintf(stderr, "termination: requested, joining\n");
    if (pthread_join(thread, NULL))
        __builtin_trap();
    fprintf(stderr, "termination: joined\n");
    if (group)
        JSContextGroupRelease(group);
    pthread_cond_destroy(&task.condition);
    pthread_mutex_destroy(&task.mutex);
    return group && task.result == 1;
}
