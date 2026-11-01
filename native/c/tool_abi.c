/* Native struct and function-pointer ABI adaptation for Wave tooling. */
#define _POSIX_C_SOURCE 200809L
#include <dlfcn.h>
#include <stdint.h>
#include <stddef.h>
#include <signal.h>
#include <sys/resource.h>

/* Opt-in deployment diagnostic only. Wave chooses the child and byte limit. */
int32_t jsrt_deploy_diagnostic_file_limit(uint64_t bytes) {
    struct rlimit limit;
    struct sigaction action = {0};
    if (!bytes || getrlimit(RLIMIT_FSIZE, &limit)) {
        return -1;
    }
    rlim_t requested = (rlim_t)bytes;
    if ((uint64_t)requested != bytes || requested == RLIM_INFINITY) {
        return -1;
    }
    if (limit.rlim_cur != RLIM_INFINITY && requested > limit.rlim_cur) {
        requested = limit.rlim_cur;
    }
    action.sa_handler = SIG_IGN;
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGXFSZ, &action, NULL)) {
        return -1;
    }
    limit.rlim_cur = requested;
    return setrlimit(RLIMIT_FSIZE, &limit) ? -1 : 0;
}

int32_t jsrt_engine_has_symbol(const char *path, const char *name) {
    void *library = dlopen(path, RTLD_NOW | RTLD_LOCAL);
    if (!library)
        return -1;
    int32_t found = dlsym(library, name) != NULL;
    dlclose(library);
    return found;
}

int32_t jsrt_probe_engine(const char *path, uint32_t *version) {
    void *library = dlopen(path, RTLD_NOW | RTLD_LOCAL);
    if (!library)
        return -1;
    const char *names[] = {"jsc_get_major_version", "jsc_get_minor_version",
                           "jsc_get_micro_version"};
    for (int index = 0; index < 3; index++) {
        unsigned (*get_version)(void) = (unsigned (*)(void))dlsym(library, names[index]);
        if (!get_version) {
            dlclose(library);
            return -1;
        }
        version[index] = get_version();
    }
    dlclose(library);
    return 0;
}
