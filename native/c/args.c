/* Entry-point/variable ABI adaptation shared by Wave executables. */
#include <stddef.h>
#include <stdint.h>

extern int __real_main(void);
extern char **environ;
static int runtime_argc;
static char **runtime_argv;

int32_t jsrt_argc(void) {
    return runtime_argc;
}
const char *jsrt_argv(int32_t index) {
    return index >= 0 && index < runtime_argc ? runtime_argv[index] : NULL;
}
char **jsrt_environment(void) {
    return environ;
}
int __wrap_main(int argc, char **argv) {
    runtime_argc = argc;
    runtime_argv = argv;
    return __real_main();
}
