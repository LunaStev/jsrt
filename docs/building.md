# 깨끗한 소스에서 빌드하기

이 문서는 새 clone에서 따라 하는 순서다. 작업 폴더의 `target/`은 Git에 포함되지 않으므로
README의 예시 후보 경로(`candidate-…`)는 자신의 엔진 빌드가 출력한 경로로 바꿔야 한다.

검증 범위: 2~5단계의 명령과 변수는 이 작업 공간의 도구 소스와 기존 `target/`으로 확인했다.
**빈 디렉터리에서 엔진을 처음부터 다시 컴파일하는 전체 과정은 아직 새 환경에서 재현 검사하지 않았다.**
엔진 빌드는 소스 다운로드와 긴 컴파일을 포함한다. 새 환경에서 실행한 결과가 이 문서와 다르면
문서를 고친다.

## 1. 준비물

| 항목 | 요구 사항 |
| --- | --- |
| Wave 컴파일러 | `wavec`와 그 컴파일러가 가리키는 표준 라이브러리 `std`. 마지막으로 확인한 조합은 wavec 0.2.1-pre-beta, LLVM 21.1.8이다 |
| C/C++ | C11을 지원하는 `cc`(CC 환경 변수로 변경)와 C++ 컴파일러, `clang-format`(포맷 검사용) |
| 엔진 빌드 | `cmake`, `ninja`, `curl`, `tar`, `patch`, `sha256sum`, Ruby 3, ICU 개발 파일 |
| 네트워크 | 시스템 libcurl 8.13.0 이상(TLS·비동기 DNS), OpenSSL, libarchive |
| TLS 통합 검사 | Go 컴파일러(`JSRT_GO`로 경로 지정). 검사 상대만 컴파일하며 런타임에는 링크되지 않는다 |
| 선택 | Valgrind(`worker-leaks`), `actionlint`(워크플로 검사) |

libuv와 llhttp, wjson은 `vendor/`에 고정된 소스를 쓴다. 따로 받을 필요가 없다.

## 2. 환경 변수

```sh
# 필수가 아니면 기본값을 쓴다.
export JSRT_WAVEC=/path/to/wavec            # 기본값: PATH의 wavec
export JSRT_STD_ROOT=/path/to/wave/std      # 기본값: wavec와 같은 폴더의 std
export JSRT_GO=/path/to/go                  # TLS 통합 검사에만 필요
```

`bootstrap.sh`는 Wave 빌드 도구만 컴파일해 실행한다. 이후의 모든 조정은 Wave가 맡는다.

## 3. 엔진 후보 만들기

JavaScriptCore는 WebKitGTK 2.54.1 소스에 프로젝트 패치를 적용해 만든다.

```sh
./bootstrap.sh engine-build
```

이 명령은 다음을 순서대로 수행한다.

1. `https://webkitgtk.org/releases/webkitgtk-2.54.1.tar.xz`를 `target/engine-source/`에 받는다.
2. `native/engine/webkitgtk-2.54.1.sha256`으로 원본 SHA-256을 확인한다.
3. 세 패치를 `--fuzz=0`으로 적용하고 표지 파일을 남긴다.
4. CMake(JSCOnly)와 Ninja로 JavaScriptCore를 빌드한다.

성공하면 마지막 줄에 다음과 같은 경로를 출력한다. 이 경로를 다음 단계에서 쓴다.

```text
Candidate engine: target/engines/jsc-module-2.54.1/candidate-<해시>/libJavaScriptCore.so
```

소스 해시가 다르거나 이미 표지 없는 소스가 있으면 도구가 중단하며 기존 폴더를 지우지 않는다.
이 명령은 런타임을 게시하지 않는다.

## 4. 빌드와 전체 검사

```sh
export ENGINE=target/engines/jsc-module-2.54.1/candidate-<해시>/libJavaScriptCore.so

./bootstrap.sh build --engine-library "$ENGINE"
./bootstrap.sh test  --engine-library "$ENGINE" --require-tcp --probe-worker-termination
```

- `build`는 전체 회귀가 통과해야만 `target/native/jsrt`를 교체한다. 실패하면 이전 실행 파일이 남는다.
- `test`는 게시된 실행 파일을 독립적으로 다시 검사한다.
- `--require-tcp`는 실제 소켓 검사를 필수로 한다. 소켓이 막힌 샌드박스에서는 실패한다.
- 위 환경 변수 대신 `JSRT_JSC_LIBRARY`에 같은 경로를 지정해도 된다.

JSC 2.54.1보다 오래된 엔진은 기본 거부된다. `--allow-older-engine`은 별도로 표시되는
호환 빌드를 만든다.

## 5. 선택 검사와 배포물

```sh
./target/native/jsrt --info                                   # 실제 엔진과 라이브러리 버전
./bootstrap.sh test-npm --engine-library "$ENGINE" --require-tcp  # 공개 npm HTTPS 필요
./bootstrap.sh worker-leaks 256                               # Valgrind 필요
./bootstrap.sh release --engine-library "$ENGINE"             # 60초 부하 포함
```

`release`는 이번 실행의 archive 경로를 `Release artifact: <경로>`로 출력한다. `target/dist/`에는
이전 archive가 남아 있을 수 있으므로 서명, 업로드, VM 검사에는 이 경로의 파일만 사용한다.
CI 워크플로는 이 줄에서 archive를 골라 `target/upload/`에 복사한 뒤 처리한다.
서명과 검증 명령은 [배포 안내](distribution.md)를 따른다.

## 6. 흔한 실패

| 증상 | 원인과 조치 |
| --- | --- |
| `set JSRT_STD_ROOT …` | wavec 옆에 `std`가 없다. `JSRT_STD_ROOT`를 지정한다 |
| `could not resolve external package 'wjson'` | 직접 `wavec check`를 실행했다. `--dep=wjson=vendor/wjson --dep=jsrt=.`를 붙이거나 `bootstrap.sh`를 쓴다 |
| `cannot load JavaScriptCoreGTK` | 엔진 경로가 틀렸다. 3단계가 출력한 경로를 쓴다 |
| TCP 검사 2건 실패, `socket errno -1` | 소켓을 막는 샌드박스다. 일반 셸에서 실행한다 |
| TLS 통합 검사에서 Go 없음 | `JSRT_GO`로 Go 경로를 지정한다 |
