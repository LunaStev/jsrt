/* Opt-in diagnostic preload for isolated regression processes, never the runtime.
 * A debugger is preferable. This best-effort signal trace uses libc unwinding,
 * which is not guaranteed async-signal-safe and must not be used in production. */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <execinfo.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <ucontext.h>
#include <unistd.h>

static void trace_address(const char *label, void *address) {
    Dl_info info;
    if (dladdr(address, &info)) {
        dprintf(STDERR_FILENO, "%s %s+0x%lx %s\n", label, info.dli_fname,
                (unsigned long)((uintptr_t)address - (uintptr_t)info.dli_fbase),
                info.dli_sname ? info.dli_sname : "");
    }
}

static void trace_crash(int signal_number, siginfo_t *info, void *context) {
    dprintf(STDERR_FILENO, "native signal %d fault %p\n", signal_number, info->si_addr);
#if defined(__x86_64__)
    ucontext_t *state = context;
    trace_address("pc", (void *)state->uc_mcontext.gregs[REG_RIP]);
    uintptr_t *stack = (uintptr_t *)state->uc_mcontext.gregs[REG_RSP];
    for (int index = 0; index < 48; index++) {
        trace_address("stack", (void *)stack[index]);
    }
#else
    (void)context;
#endif
    void *frames[64];
    int count = backtrace(frames, 64);
    backtrace_symbols_fd(frames, count, STDERR_FILENO);
    _Exit(128 + signal_number);
}

__attribute__((constructor)) static void install_trace(void) {
    struct sigaction action = {0};
    action.sa_sigaction = trace_crash;
    action.sa_flags = SA_SIGINFO;
    sigemptyset(&action.sa_mask);
    sigaction(SIGSEGV, &action, NULL);
    sigaction(SIGBUS, &action, NULL);
    sigaction(SIGABRT, &action, NULL);
    sigaction(SIGILL, &action, NULL);
}
