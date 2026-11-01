# CI와 Linux 환경 검증

.github/workflows/release.yml은 일반/이동 배포 전체 검사·실제 npm·Worker 종료 진단,
배포 복구와 추가 부하를 수행하고 별도 test를 재실행한다. 그 산출물을 Ubuntu 26.04/26.10
사용자 공간에서 검증한다. 그 안에서 고정 npm 그래프를 HTTPS로 설치하고 Polka TCP 사례도 실행한다.
워크플로 파일을 준비한 것과 GitHub에서 실행한 결과를 구분한다.
현재 작업 디렉터리에 .git/원격 연결이 없어 여기서 원격 실행이나 runner 등록을 수행하지 않았다.

2026-10-26에 native-vm job을 추가했다. GitHub-hosted ubuntu-26.04 VM에서 artifact의
외부 SHA-256을 검사하고 압축을 푼 뒤 동봉된 Wave jsrt-deploy check를 실행한다.
이 경로는 컴파일러나 엔진 checkout 없이 실제 커널/라이브러리를 기록하고 설치·재설치·실행·삭제한다.
VM job은 disposable 호스트에 apt로 명시한 런타임 의존성을 설치한다. 기존 self-hosted job은
호스트 패키지를 자동 설치하지 않는다. 현재 세션에서는 원격 VM job을 실행하지 못했다.
호스트에서 같은 check 구현을 기존 배포물에 실행한 결과와 별도 VM 실행 결과를 구분한다.

필요한 self-hosted runner 라벨은 linux, x64, jsrt-wave-jsc다. runner에는 Wave compiler/std,
C/C++ compiler·Go compiler·cmake·make·pkg-config·개발 헤더와 런타임 시스템 의존성이 필요하다.
Go는 독립 HTTPS 검사 상대에만 쓰며, JSRT_GO로 경로를 지정할 수 있다. 배포 runtime 의존성이 아니다.
JSRT_JSC_LIBRARY 저장소 변수는 같은 모듈/Worker v2/clone ABI의 JSC 2.54.1 엔진 절대 경로다.
엔진과 컴파일러는 checkout이 정리하는 작업 폴더 밖에 둔다. JSRT_WAVEC 변수로 compiler 경로를
지정할 수 있으며 기본은 wavec다. PRoot 실행용 libtalloc.so.2와 curl/tar/dpkg-deb/sha256sum도 필요하다.
Worker native 수명 검사에는 Valgrind도 필요하다. 진단 모드만 JSC JIT를 끄며 일반 릴리스 JIT는 유지한다.
확정 누수와 잘못된 메모리 접근을 오류로 처리하고 미초기화 값 판정은 이 진단에서 끈다.
JSC의 프로세스 단위 ExecutableAllocator 한 바이트만 정확한 초기화 스택으로 제외하며,
possible/reachable 분류는 로그에 남긴다. 이를 모든 메모리 오류가 없다는 증명으로 해석하지 않는다.
루트 권한이 필요한 호스트 패키지 설치를 CI가 묵시적으로 수행하지 않는다.

선택적 JSRT_RELEASE_SIGNING_KEY_PATH 저장소 변수를 설정하면 검증 후 sign-release를 실행한다.
키는 checkout 바깥의 self-hosted runner에 관리자가 배치한 암호 없는 Ed25519 PEM이다.
CI는 키를 생성·출력·업로드하지 않으며 공개키/서명/압축본 digest만 artifact에 포함한다.
변수가 없으면 서명 단계는 실행하지 않는다. 공개키의 신뢰 배포와 원격 runner 등록은 별도 운영 설정이다.
명령과 신뢰 경계는 docs/distribution.md를 따른다.

외부 fork PR 실행은 설정하지 않았다. main/master push와 수동 실행만 릴리스 검증을 시작하며,
GitHub token은 contents:read이고 checkout 자격 증명을 남기지 않는다. Actions는 upstream의
release/stability의 checkout v4.2.2와 matrix의 checkout v7.0.1, artifact v4.6.2/v4.3.0의
커밋 SHA로 고정했다. matrix도 jsrt-wave-jsc 라벨·JSRT_WAVEC·명시적 Worker 종료 진단을 사용한다.
원격 업로드는 GitHub Actions 실행 시 artifact에 한정된다.

stability.yml은 수동 600/3600/86400초 검사와 주간 24시간 검사를 제공한다.
CSV에는 단조 시계 경과 시간·RSS KiB·FD·스레드를 기록한다. 새 파일만 만들고 기존 경로를 덮어쓰지 않는다.
실패 시에도 이미 수집한 CSV를 artifact로 올린다. workload 결과의 지연 histogram/최대 지연·작업량은
job 로그에 남는다. 24시간 경로를 구성한 것은 24시간 검사가 통과했다는 의미가 아니다.

Linux 검사는 PRoot로 별도 rootfs의 libc/ICU/libcurl/OpenSSL/libarchive를 사용한다.
호스트 /lib·/usr는 바인드하지 않는다. /proc·/dev와 배포 묶음만 바인드하고 DNS 설정은 복사한다.
같은 커널을 쓰므로 VM·컨테이너 보안 격리·다른 커널 검증으로 설명하지 않는다.
rootfs/PRoot는 고정 SHA-256이며 guest 패키지 버전은 저장소 업데이트에 따라 바뀌므로 --info를 기록한다.
Ubuntu의 uutils multicall과 PRoot 임시 실행 파일 이름이 충돌해 disposable guest에서만
공식 provider 전환 명령으로 GNU coreutils를 사용한다.

근거: [GitHub runner 라벨](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/use-in-a-workflow),
[Ubuntu coreutils provider 전환](https://ubuntu.com/server/docs/reference/other-tools/sudo-rs/),
[Ubuntu Base 26.04 SHA-256](https://cdimage.ubuntu.com/ubuntu-base/releases/26.04/release/SHA256SUMS),
[26.10 SHA-256](https://cdimage.ubuntu.com/ubuntu-base/releases/26.10/release/SHA256SUMS).
