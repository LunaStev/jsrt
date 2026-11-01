#!/bin/sh
# Bootstrap only: compile the Wave build tool, then let Wave own the build.
set -eu
cd "$(dirname "$0")"
wavec_bin=${JSRT_WAVEC:-wavec}
cc_bin=${CC:-cc}
wavec_path=$(command -v "$wavec_bin")
standard_root=${JSRT_STD_ROOT:-"$(dirname "$wavec_path")/std"}
if [ ! -d "$standard_root" ]; then
    echo 'Set JSRT_STD_ROOT to the Wave standard library directory.' >&2
    exit 1
fi
export JSRT_STD_ROOT="$standard_root"
task_bootstrap_dir=$(mktemp -d "${TMPDIR:-/tmp}/jsrt-bootstrap.XXXXXXXX")
cleanup_bootstrap() {
    task_bootstrap_status=$?
    trap - EXIT INT TERM
    for task_bootstrap_file in build.o args.o tool-abi.o filesystem-abi.o build; do
        if [ -f "$task_bootstrap_dir/$task_bootstrap_file" ]; then
            unlink "$task_bootstrap_dir/$task_bootstrap_file" || :
        fi
    done
    rmdir "$task_bootstrap_dir" || :
    exit "$task_bootstrap_status"
}
trap cleanup_bootstrap EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"$wavec_bin" "--std-root=$standard_root" build build.wave --emit=obj -C relocation-model=pic -o "$task_bootstrap_dir/build.o"
"$cc_bin" -std=c11 -O2 -Wall -Wextra -Werror -fPIE -c native/c/args.c -o "$task_bootstrap_dir/args.o"
"$cc_bin" -std=c11 -O2 -Wall -Wextra -Werror -fPIE -c native/c/tool_abi.c -o "$task_bootstrap_dir/tool-abi.o"
"$cc_bin" -std=c11 -O2 -Wall -Wextra -Werror -fPIE -c native/c/filesystem_abi.c -o "$task_bootstrap_dir/filesystem-abi.o"
"$cc_bin" -pie "$task_bootstrap_dir/build.o" "$task_bootstrap_dir/args.o" "$task_bootstrap_dir/tool-abi.o" "$task_bootstrap_dir/filesystem-abi.o" -Wl,--wrap=main -Wl,-z,relro,-z,now -Wl,-z,noexecstack -ldl -lm -o "$task_bootstrap_dir/build"
"$task_bootstrap_dir/build" "$@"
