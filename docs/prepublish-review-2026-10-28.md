# GitHub 공개 전 프로젝트 재점검 — 2026-10-28

후속 구현에서 아래 중복 헤더 손실·CI lint 실패를 수정했고 HTTPS 본문/실패 검사도 확장했다.
최신 결과는 [IMPLEMENTATION.md](../IMPLEMENTATION.md)를 따른다. 아래 표와 P1 목록은
수정 전 점검 스냅샷이며, 완료한 항목을 현재 미수정으로 다시 계산하지 않는다.

이번 요청은 공개 전 점검이다. GitHub 게시·원격 workflow 실행·운영 서명·새 release·장시간 soak는
실행하지 않았다. 런타임·CI 동작은 바꾸지 않았고 영구 네트워크 진단 소스와 점검 기록을 추가했다.
직전 배포 묶음의 성공 기록과 이번 새 실행 결과를 구분한다.

## 판단

기존 기능의 전체 회귀는 다시 통과했지만 공개 바이너리의 검증을 마쳤다고 표시하기에는
중복 응답 헤더 손실, CI 설정 검사 실패, HTTPS 업로드·독립 VM·운영 서명 미검증이 남아 있다.
API 미구현 목록 전체를 먼저 완성할 필요는 없다. 현재 제공하는 기능의 오류와 재현 가능한
빌드/검증 경로부터 해결하고, 나머지는 개발 버전의 지원 제한으로 명시한다.

아래 P1/P2는 작업 우선순위다. 보안 취약점 등급이나 CVSS를 뜻하지 않는다.

## 여러 차례의 교차 점검 결과

| 점검 축 | 이번 실제 결과 |
| --- | --- |
| 구조·의존 방향 | Wave 153모듈·내부 import 816개, 누락·순환·미해석 import 0 |
| 타입 검사 | runtime/main.wave·build.wave·test.wave의 Wave check 모두 exit 0 |
| 네이티브 가독성 | 프로젝트 C/C++·헤더·영구 C 검사 입력의 clang-format 검사 exit 0 |
| 영구 JS 구문 | JSC에서 JS/MJS/CJS 18개 --check 통과. 새 네트워크 진단 포함 |
| 전체 회귀 | 샌드박스 밖 test --require-tcp --probe-worker-termination: 1054개·실패 0·네트워크 생략 0, Worker 종료 exit 0 |
| 컨텍스트 수명 | 전체 회귀 안의 워밍업 뒤 16회, FD 기준 5, RSS KiB 시작/최고/끝 54352/55392/55392 |
| 기존 API 진단 | 91그룹·확인 38·차이 53·대조군 실패 0. 기존 결과와 같음 |
| 별도 네트워크 진단 | 두 번 실행 모두 7그룹·차이 3·대조군 실패 0. 같은 헤더 손실 경로의 3가지 관측 |
| Worker native 수명 | ./bootstrap.sh worker-leaks 256: Valgrind exit 0, 확정/간접 누수 0, 오류 0 |
| Node-API 표면 | 동적 export napi_* 48개와 부분 헤더 선언 목록 일치, 추가/누락 0 |
| 엔진 소스 | 고정 원본 archive SHA-256 일치. 임시 복사본에서 패치 3개를 역순으로 제거한 6개 파일이 upstream 원본과 바이트 단위 일치 |
| 실행 파일 | PIE·RELRO·BIND_NOW·실행 불가 stack, ldd 누락 없음. 개발 binary의 절대 engine RUNPATH는 배포용 상대 RUNPATH와 구분 |
| 실제 archive | 외부 SHA-256/sidecar 일치. /tmp로 새로 풀어 동봉 jsrt-deploy check exit 0: 검증·설치·동일 세대 재설치·실행·삭제 |
| CI 정적 검사 | actionlint v1.7.12 exit 1: jsc-matrix.yml:17의 jsrt 라벨이 현재 actionlint 설정에 없음 |
| 로컬 배포 선택 | linux-check --image 26.04는 배포 archive가 6개라 exit 2. archive를 명시해야 하며 실제 guest 검사는 이 호출에서 시작하지 않음 |

Valgrind는 진단에서만 JIT/Wasm을 끄고 미초기화 값 판정을 끈다. possible 456바이트,
reachable 1152바이트, 기존 정확한 엔진 초기화 스택 suppression 1바이트가 남았다.
확정 누수·오류 0을 전체 누수 부재나 일반 JIT 실행 전체의 안전성으로 해석하지 않는다.
archive check는 현재 호스트 커널에서 실행했으며 독립 VM 결과가 아니다.
기존 API 차이 53그룹과 별도 네트워크 차이 3그룹을 버그/취약점 개수나 전체 호환 점수로 합산하지 않는다.

## P1: 먼저 해결할 항목

### 1. 클라이언트 중복 응답 헤더가 사라진다 — 실소켓 재현

담당: runtime/http_client.wave:570의 response_headers, 특히 605행의 같은 키 put.
서버는 setHeader의 문자열 배열을 별도 헤더 행으로 정상 전송하지만 클라이언트 dictionary가
이전 값을 덮어쓴다. 기존 ROADMAP에 있던 소스 수준 우려를 이번에는 실제 TCP로 확인했다.

| 입력 | 관측 |
| --- | --- |
| Set-Cookie: first=1; Path=/ 및 second=2; Path=/ | http.get 응답에 문자열 second=2; Path=/만 남음 |
| X-Audit: one 및 X-Audit: two | http.get 응답 값이 two뿐임 |
| 같은 응답의 fetch Headers.get('x-audit') | two뿐임 |

단일 헤더·본문·POST 303의 GET 전환·POST 307의 본문 보존 대조군은 정상이다.
tests/npm_compat.js의 API 앱은 서버에서 쿠키 2개를 설정하지만 클라이언트 수신 결과를
검사하지 않아 기존 npm 통과가 이 문제를 잡지 못한다.

완료 조건: Wave에서 중복값을 보존하고, Node 응답의 Set-Cookie 배열과 일반 중복 헤더 결합,
fetch 쪽 보존 방식을 명시한다. 두 소비 경로와 실제 npm API 앱에 엄격한 회귀를 등록한다.
Set-Cookie의 Expires에 있는 쉼표를 일반 구분자로 잘라 처리하면 안 된다.
진단 소스의 gap 보고만으로 수정 후 회귀 검사를 대신하지 않는다.

### 2. CI 설정 검사가 현재 실패한다 — 도구 재현

.github/workflows/jsc-matrix.yml:17은 jsrt를 요구하지만 release/stability와
.github/actionlint.yaml은 jsrt-wave-jsc를 사용한다. 별도 runner 집합을 의도했다면
그 실제 등록과 lint 설정을 함께 관리해야 한다. 현재 원격 runner 등록은 확인하지 못했다.

완료 조건: 의도한 runner 라벨을 정하고 workflow·actionlint·문서가 일치하도록 정리한 뒤
세 workflow의 lint를 통과시킨다. matrix의 JSRT_WAVEC 전달과 명시적 Worker 종료 probe도
release/stability와 같은 기준으로 사용할지 정한다. 이 둘은 lint 오류와 별개의 검증 정책 차이다.

checkout v7.0.1 고정 SHA는 upstream에 실제로 존재한다. 유효하지 않은 커밋으로 잘못 분류하지 않는다.
다른 workflow는 checkout v4.2.2를 쓰므로 runner의 실제 지원 버전과 문서 설명을 맞춰야 한다.
ubuntu-26.04는 현재 GitHub 공식 runner 목록에 있다. actionlint의 custom-label 허용만으로
원격 VM이 실행됐다고 판단하지는 않는다.

### 3. HTTPS 업로드 경로를 실제로 검증한다 — 실행 공백

tests/tls_request.js와 network_client.wave의 OpenSSL -www fixture는 신뢰 CA,
인증서/hostname 거부와 GET 다운로드를 검사한다. 직전의 Blob·Request·FormData·Web Stream
본문 전송은 HTTP에서 검증했다. TLS 다운로드 통과를 HTTPS 업로드 통과로 확대하지 않는다.

완료 조건: TLS를 종료하고 요청 본문을 확인할 독립 fixture를 추가해 바이너리·multipart·
Web Stream 전송, 분할 입력·역압력·중도 취소·TLS 실패·redirect 제한과 종료 자원 회수를 검사한다.
런타임 서버 TLS API를 새로 구현해야 하는 것은 아니다. HTTPS 업로드를 실행할 수 있는
검사 상대가 필요한 작업이다.

### 4. 깨끗한 소스에서 재현할 빌드 안내를 만든다 — 공개 준비

README.md:18의 candidate-92596... 경로는 /target 아래이며 Git에 포함되지 않는다.
새 clone에서 그대로 실행할 수 있는 경로가 아니다. ./bootstrap.sh engine-build는 후보를 만들지만,
실제 compiler/std 준비·버전·의존성·출력 엔진 경로 선택까지 연결한 처음부터의 안내가 필요하다.

이번 compiler는 wavec 0.2.1-pre-beta, LLVM 21.1.8이다. 기본 JSC baseline 2.54.1은 유지한다.
완료 조건: 컴파일러와 compiler-pinned std의 확보/버전 확인, 시스템 빌드 의존성,
엔진 빌드와 출력 경로 설정, build/test --require-tcp 순서를 작성하고 깨끗한 환경에서 확인한다.
전체 엔진을 이번 점검에서 처음부터 다시 컴파일한 것은 아니다.

### 5. 공개할 파일과 검증할 배포물의 범위를 고정한다 — 공개 준비

현재 작업 폴더는 git status가 실패하는 상태여서 tracked/staged 파일과 히스토리를 검사할 수 없다.
.gitignore는 /target/ 한 줄이다. 공개 전 .aws·환경 파일·운영 키·개인 IDE 설정을
포함하지 않는 소스 allowlist/ignore 정책과 실제 staged diff 검사가 필요하다.
.vscode/settings.json에는 현재 사용자의 절대 경로가 있다.
선별한 공개 후보 텍스트에서 private-key/GitHub-token/AWS-key 정규식 일치는 없었지만,
보호된 로컬 설정 경로·vendor·target은 이 텍스트 검사에서 제외했으며 히스토리 secret scan도 아니다.
현재 비밀이 유출됐다고 확인한 것은 아니다.

release.yml:33은 dist의 모든 archive를 서명하고 39행은 디렉터리 전체를 업로드한다.
이후 Linux 검사와 VM 검사는 archive 하나를 요구한다. 깨끗한 checkout의 보통 실행에는
하나가 생기지만 기존 산출물이 섞인 재실행은 다를 수 있다. 현재 로컬 dist에는 6개가 있다.
완료 조건: 기존 파일을 임의 삭제하지 않고 이번 실행의 정확한 archive/sidecar/signature만
선택해 전달한다. 서명 뒤 신뢰 공개키로 verify-release를 통과시키고 키의 신뢰 배포 방법을 정한다.

## P2: 함께 정리할 정확성·운영 항목

- runtime/modules.wave:160, :439의 "ES modules are not implemented"는 전체 ESM 미구현으로
  오해하게 한다. require(ESM) 또는 CommonJS 경로의 제한을 정확하게 설명해야 한다.
- docs/compatibility.md:120은 실제 TCP 업로드도 미완료라고 써서 같은 문서 상단의 최신
  HTTP 전송 성공 기록과 모순된다. HTTP 성공/HTTPS 업로드 미검증으로 맞춘다.
- docs/ci.md:35의 Actions 버전 설명은 matrix의 checkout v7을 포함하지 않는다.
- runtime/info.wave의 0.1.0-dev와 공개 태그/릴리스 명칭·지원 플랫폼·알려진 제한을 맞춘다.
  개발 prerelease로 공개하는 것과 안정판이라고 표시하는 것은 구분한다.
- 실제 원격 CI/VM·운영 서명/공개키·공개 업로드는 아직 없다. 계정/저장소/runner 정보를
  확보한 뒤 실행 결과로 완료 처리한다. 로컬 archive check는 독립 VM 완료가 아니다.
- JSC 2.54.2는 공식 후속 수정판이다. 이를 이유로 기준선을 바꾸거나 현재 JSCOnly의 특정
  취약점을 단정하지 않는다. 새 후보는 ABI 패치 이식·전체 검증 뒤에 선택한다.
  시스템 libcurl/OpenSSL/libarchive는 upstream 숫자와 배포판 backport를 함께 판단한다.

API 확대 목록의 Readable.from·Node async iterator·File·네트워크 Response clone·net/tls/dns·
고급 패키지 풀이·확장 Node-API·개발 도구는 별도 후속 범위다. 전부 완성해야 소스를 공개할 수
있는 것은 아니다. 해당 기능을 지원한다고 표시하려면 구현과 실제 검사가 먼저 필요하다.
CPU 실행 제한·다른 JS 엔진·JS bootstrap·엔진 JSON fallback은 작업 목록에 추가하지 않는다.

## 산출물과 재현

runtime SHA-256: d52caffff1acff52de1740a70c4fd57dc1505fff613367a282075cdd78314e21.
현재 검증 archive의 SHA-256: b6560fea0f9ac94569660c715f55e9b4652bcbb625e731518fa82ff90b44eff8.
이번 점검 뒤에도 두 값은 동일하다. 배포물을 새로 만들거나 수정하지 않았다.

```sh
./bootstrap.sh test --engine-library target/engines/jsc-module-2.54.1/candidate-92596ae086a103c82a53c64b1c3c875a/libJavaScriptCore.so --require-tcp --probe-worker-termination
./target/native/jsrt tests/audit_matrix.js
./target/native/jsrt tests/prepublish_network_audit.js
./bootstrap.sh worker-leaks 256
```

새 진단 소스는 gap을 보고해도 대조군이 정상이면 exit 0이다. 마지막 summary의 gaps를 확인해야 한다.
소켓 허용 환경이 필요하다. 전체 회귀 1054개와 진단 91/7그룹을 합산하지 않는다.
임시 runner·Valgrind 로그·Go 도구/cache·추출/패치 점검 복사본은 정리했다.
이전 사용자 종료 54분 10초와 직전 release의 60초는 그대로이며 이번에는 부하를 재시작하지 않았다.

## 이번에 확인한 upstream 근거

- [actions/checkout v7.0.1 고정 커밋](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1)
- [같은 checkout의 runner 요구사항](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/README.md)
- [GitHub-hosted runner 공식 목록](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [실행한 actionlint v1.7.12](https://github.com/rhysd/actionlint/releases/tag/v1.7.12)
- [WebKitGTK 2.54.2 공식 수정판 안내](https://webkitgtk.org/2026/10/23/webkitgtk2.54.2-released.html)
- [WebKitGTK 보안 공지](https://webkitgtk.org/security.html)

이번 판단은 위 교차 점검과 실행한 사례에 한정한다. 전체 표준 적합성·모든 공격 경로·정전/디스크
고장·다른 아키텍처의 완료 판정은 아니다.
