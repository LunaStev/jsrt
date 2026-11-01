/* Directory-entry layout adaptation only; traversal and recovery policy are Wave. */
#define _POSIX_C_SOURCE 200809L
#include <dirent.h>
#include <errno.h>
#include <stdint.h>
#include <string.h>
#include <sys/resource.h>
#include <fcntl.h>
#include <sys/stat.h>

/* POSIX struct/constant ABI only; opt-in resource policy lives in Wave. */
int32_t jsrt_address_space_limit(uint64_t bytes) {
    struct rlimit limit;
    if (!bytes || getrlimit(RLIMIT_AS, &limit))
        return -1;
    rlim_t requested = (rlim_t)bytes;
    if ((uint64_t)requested != bytes || requested == RLIM_INFINITY)
        return -1;
    /* Never relax an existing session limit. Leave the hard limit unchanged. */
    if (limit.rlim_cur != RLIM_INFINITY && requested > limit.rlim_cur)
        return -1;
    if (limit.rlim_max != RLIM_INFINITY && requested > limit.rlim_max)
        return -1;
    limit.rlim_cur = requested;
    return setrlimit(RLIMIT_AS, &limit) ? -1 : 0;
}

int32_t jsrt_directory_next(void *directory, char *name, int64_t capacity) {
    errno = 0;
    struct dirent *entry = readdir(directory);
    if (!entry)
        return errno ? -1 : 0;
    size_t length = strlen(entry->d_name);
    if (capacity <= 0 || length >= (uint64_t)capacity)
        return -1;
    memcpy(name, entry->d_name, length + 1);
    return 1;
}

int32_t jsrt_directory_mode(void *directory, const char *name, int64_t *mode) {
    struct stat info;
    if (fstatat(dirfd(directory), name, &info, AT_SYMLINK_NOFOLLOW))
        return -errno;
    *mode = info.st_mode;
    return 0;
}
