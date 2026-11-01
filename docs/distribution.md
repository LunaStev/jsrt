# jsrt Linux x86_64 배포

Wave 호스트와 모듈/Worker ABI를 포함한 JavaScriptCore 2.54.1 묶음이다.
설치에는 Wave 컴파일러가 필요하지 않으며 Linux x86_64에서 검증한다.

## 검증과 설치

압축을 푼 디렉터리에서 다음 명령을 실행한다. prefix의 부모는 미리 있어야 한다.

    ./bin/jsrt-deploy verify --bundle "$PWD"
    ./bin/jsrt-deploy install --bundle "$PWD" --prefix "$HOME/jsrt"
    "$HOME/jsrt/bin/jsrt" --info

SHA256SUMS는 고정된 파일 목록과 각 파일의 바이트를 확인한다. 배포자의 신원 인증은 아니다.
외부 배포 파일의 SHA-256은 신뢰하는 출처의 값과 비교한다.
CJS·ESM·Worker·파일·암호·UTF-8 스트림 실행 점검이 성공해야 설치한다.

## 업데이트·롤백·삭제

새 묶음의 install에 같은 prefix를 전달하면 업데이트한다. 기존 실행 파일을 덮어쓰지 않고
releases 아래의 완전한 세대를 만든 뒤 current 링크를 원자적으로 바꾼다. 이전 세대는 previous로 남긴다.

    "$HOME/jsrt/bin/jsrt-deploy" rollback --prefix "$HOME/jsrt"
    "$HOME/jsrt/bin/jsrt-deploy" recover --prefix "$HOME/jsrt"
    "$HOME/jsrt/bin/jsrt-deploy" uninstall --prefix "$HOME/jsrt"

관리 표식·소유자·파일 형태·체크섬이 맞지 않거나 외부 파일이 추가되면 수정/삭제를 거부한다.
복사와 활성화 전에 소유 staging 경로를 fsync한 복구 기록에 남긴다. recover는 current/previous의
체크섬과 세대 정체성을 확인한 뒤 기록이 가리키는 private staging만 정리한다. install/rollback도
이 복구를 먼저 수행한다. 미인식 staging·잘못된 기록은 보존하며 삭제를 거부한다.
복사 예약/완료·세대 게시·활성화 준비·previous/current 교체의 여섯 지점에서 실제 SIGKILL 후
recover/재시도/실행을 검사한다. I/O 오류 분기 주입은 실제 디스크 고장이나 정전 실험을 대신하지 않는다.
추가로 진단용 자식의 파일 크기 soft limit을 사용해 커널 write 실패(EFBIG)를 검사한다.
호스트나 JavaScript 실행에는 이 진단 제한을 적용하지 않는다.
current와 previous 두 경로의 전원 차단 원자성은 보장하지 않는다.

## 시스템 의존성

JSC는 lib 디렉터리에 포함하며 실행 파일의 RUNPATH는 $ORIGIN/../lib다.
libcurl >= 8.13.0(TLS·비동기 DNS), OpenSSL 3, libarchive, libstdc++, glibc,
동봉 JSC가 요구하는 ICU 등은 호환되는 시스템 라이브러리로 제공해야 한다.
실제 버전은 runtime-info.json에 기록하며 설치 호스트에서 다시 실행 점검한다.
정적 바이너리나 모든 Linux 배포판 호환 묶음은 아니다. jsrt-deploy는 /usr/bin/sha256sum을 사용한다.
이 빌드의 JSC에는 ICU 78 ABI가 필요하다. OpenSSL 4만 있는 환경에는 libcrypto.so.3가 없을 수 있어
OpenSSL 3 호환 라이브러리도 설치해야 한다. 도구가 실제 링크된 버전을 --info로 다시 기록한다.

## 재빌드

    ./bootstrap.sh release --engine-library <동일한 모듈 ABI의 JSC 라이브러리>
    ./bootstrap.sh soak --duration-seconds 600
    ./bootstrap.sh soak --duration-seconds 3600 --report <새 CSV 파일>
    ./bootstrap.sh linux-check --archive <묶음.tar.gz> --image 26.04
    ./bootstrap.sh linux-check --archive <묶음.tar.gz> --image 26.10

release는 전체 회귀·필수 TCP/TLS·실제 npm·Worker 종료 검증 뒤 상대 RUNPATH로 다시 링크한다.
이동한 묶음·깨끗한 환경·설치/업데이트/롤백/거부/삭제·추가 부하 검사도 수행한다.
성공한 tar.gz와 외부 SHA-256만 target/dist에 게시한다. 원본 프로젝트·엔진 캐시는 포함하지 않는다.
linux-check는 고정 SHA-256 Ubuntu Base와 PRoot를 사용하며 root 권한이 필요 없다.
guest 패키지 인덱스/서명 검증 후 시스템 의존성을 설치한다. 호스트 커널을 공유하는 사용자 공간 검사이며
다른 커널·VM 검증이나 격리 환경은 아니다. PRoot 실행을 위해 disposable guest의 coreutils만 GNU로 전환한다.

## 독립 Linux 호스트 검사와 서명

새 배포 도구의 check는 임시 설치 위치를 자체 예약하고 검증·설치·동일 세대 재설치·실행·삭제한다.
도구와 설치된 런타임의 실행 결과 및 실제 커널·라이브러리 버전을 기록한다.

    ./bin/jsrt-deploy check --bundle "$PWD"
    ./bootstrap.sh check-release --bundle <압축을 푼 묶음 디렉터리>

check 명령은 2026-10-28의 새 로컬 검증 압축본에 포함돼 있다. 이전 10월 24일 압축본에는 없다.
원격 CI의 ubuntu-26.04 VM 경로는 준비됐지만 실제 실행 결과는 아직 없다.

서명은 OpenSSL의 Ed25519로 압축본 SHA-256과 개행 한 바이트를 포함한 65바이트 메시지에 수행한다.
서명 도구는 임시 작업공간을 정리하고, 기존 서명 출력 디렉터리를 덮어쓰지 않는다.
암호 없는 PEM 키를 명시적으로 전달해야 하며 운영 키는 사용자가 별도로 관리한다.

    ./bootstrap.sh sign-release --archive <묶음.tar.gz> --key <private.pem> --output <새 서명 디렉터리>
    ./bootstrap.sh verify-release --archive <묶음.tar.gz> --public-key <신뢰하는 public.pem> --signature-directory <서명 디렉터리>

검증은 압축을 풀거나 코드를 실행하기 전에 수행한다. 배포물에 동봉된 public-key.pem만으로
배포자 신원을 신뢰하지 않는다. 검증 명령에는 별도 경로로 확보한 공개키를 전달해야 한다.
이번 검사는 폐기용 키로 성공·변조·위조 거부를 확인하며 운영 서명본을 발행한 것은 아니다.
서명 형식은 [OpenSSL pkeyutl](https://docs.openssl.org/3.5/man1/openssl-pkeyutl/)의 raw Ed25519를 사용한다.
