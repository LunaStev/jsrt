# 구현 및 검증 상태

기준: 2026-10-28. 호스트·정책·빌드 조정은 Wave이며 실행·GC/JIT·Promise 작업은 JSC다.
JSON.parse/JSON.stringify는 Wave wjson을 사용한다. 전체 Node/Bun/npm/WHATWG 호환은 아니다.

## 의존성·생성자 ABI 재검증

Abort API와 EventTarget이 공통 abort_state.wave를 참조하도록 정리하고,
순환 의존을 우회하던 취소 상태 C ABI 함수 3개를 제거했다.
테스트 분리 뒤 runtime/tools/tests/suites와 두 진입점의 Wave 모듈 153개·내부 import 816개를 검사했다.
누락 참조·순환 참조는 0이며, ldd에서도 미해결 라이브러리는 없었다.

Web/Worker는 범용 jsrt_create_callable_constructor를 함께 사용한다.
기존 엔진의 Worker ABI v2 factory 계약은 유지하고, 심볼·버전·NULL 인자를 검사한다.
비호출 생성자로 조용히 대체하는 경로를 제거했다. --info에 실제 감지 결과를 표시한다.
native 거부/정상 호출 검사와 실제 JSC의 기존 Web/Worker·수명·독립 컨텍스트 회귀를 통과했다.

## 테스트 분야별 분리

사용자가 전체 분야별 분리를 선택했다. test.wave는 4,446줄에서 6줄의 진입점으로 줄였고,
tests/suites의 runner·harness와 13개 분야 모듈로 실행 조정·공통 검증·사례를 나눴다.
기존 72개 함수는 공유 상태 접근을 제외한 본문·문자열을 대조했고, inline JS·타이머 사례의
추출 전후 실행 순서도 유지했다. 영구 JS/C 회귀 입력과 실패·생략 기준은 그대로다.

테스트 컴파일에만 --dep=jsrt=.를 전달해 하위 모듈에서 프로젝트 모듈을 참조한다.
C ABI 선언은 실제 심볼명을 명시하며, 병렬 JSC 콜백은 runner의 공유 집계에 접근하지 않는다.
분야별 책임과 실행 방법은 [테스트 구성](tests/suites/README.md)에 정리했다.

## 이번 완료한 구현

사용자가 소켓 허용 터미널에서 실행한 --require-tcp 검사는 **1050개·실패 9·생략 0**이었다.
Worker 종료 진단과 HTTPS 검사는 통과했지만, HTTP 요청 EOF·응답 finish에서 일반 스트림의
autoDestroy가 공유 소켓의 _destroy를 실행해 조기에 닫는 수명 오류를 확인했다.
서버 요청·응답의 자동 파괴를 끄고 기존 HTTP close/recycle이 정상 종료를 소유하게 수정했다.
명시적 destroy와 실패 시 파괴는 유지한다. 소켓 없는 실제 dispatch 회귀 4건을 추가했으며,
수정 전에는 EOF·finish 검사 2건이 실패했다. 2026-10-28에 샌드박스 밖에서 실제 TCP 전체
검사를 통과했다. 수정 전 실소켓 9건의 실패는 이번 실행에서 재현되지 않았다.

tests/io_network.js에 Request 원본/clone의 독립 업로드, Blob의 DataView 바이너리 전송,
FormData의 중복 필드·한글·파일 바이트와 multipart boundary 일치 검사를 추가했다.
기존 Web Stream 업로드·응답 Readable.toWeb·취소·역압력·keep-alive와 함께 실제 HTTP로 통과했다.
공개 npm HTTPS 검사 38개도 통과했고 새 API 앱·CLI 앱을 고정 패키지 그래프로 실행했다.
후속 수정에서는 실제로 재현한 클라이언트 중복 응답 헤더 손실을 고쳤다. Node HTTP 응답의
Set-Cookie 배열·Cookie 세미콜론 결합·일반 헤더 쉼표 결합·singleton의 첫 값 보존을 처리한다.
Fetch는 별도 정책으로 일반 중복 값을 결합하고 Headers.getSetCookie에 각 쿠키를 보존한다.
Headers 복사·Request/Response·clone·get/set/append/delete·정렬된 live 반복·forEach에서도
쿠키의 경계와 Expires 쉼표를 보존하며 조회 배열/반복 pair는 private 상태와 독립적이다.
정규화된 응답 헤더에 기존 16 KiB·64개 예산을 적용하고 반복 쿠키의 이름·행도 포함한다.
원격 헤더 검증 실패는 해당 fetch를 reject하거나 request error로 전달하고 client 슬롯을 회수한다.

tests/https_peer.go는 독립 TLS 검사 상대다. Wave 도구가 private 캐시로 컴파일·정리하고
프로세스·인증서·로그·실행 파일 수명을 소유한다. Go는 runtime에 링크되지 않는다.
실제 HTTPS에서 바이트·Blob·Request 원본/clone·FormData의 중복/한글/파일·Web Stream 업로드,
느린 읽기 상대의 전송, 활성 응답 취소·정확한 원인, downgrade 거부와 인증서/hostname 거부를 통과했다.
20회의 과대 헤더 fetch 실패와 Node HTTPS error 뒤 새 요청 성공으로 슬롯 반환도 확인했다.
진행 중인 업로드 자체의 중간 취소와 더 넓은 전이/동시성 조합은 후속 검사 범위다.

JSC matrix의 runner 라벨·JSRT_WAVEC·명시 Worker 종료 probe를 정리했다.
세 workflow는 actionlint v1.7.12 exit 0이다. 실제 원격 실행을 뜻하지 않는다.
CommonJS 경로의 ESM 거부 문구도 require/import의 실제 지원 범위로 바로잡았다.

- GET Request 복사·null body·bodyUsed·기본/dependent signal, URL 자격 증명 검증을 수정했다.
- Blob이 일반 iterable과 DataView·typed view의 실제 바이트/offset/length를 복사한다.
  Blob getter/slice와 Request/Response clone은 정확한 receiver를 검사한다.
- 실패한 본문의 clone은 원래 오류를 유지한다. Response 메타데이터는 쓰기 불가다.
- FormData의 URL 전용 문자열 한도를 없애고 live iterator·primitive thisArg를 보완했다.
- Node 스트림의 encoding·allowHalfOpen:false·autoDestroy·readable 이벤트와
  Duplex의 Writable instanceof를 구현했다. HTTP 요청은 별도 전송 수명을 유지한다.
- TextEncoder/Decoder의 UTF-8·encodeInto scalar 경계·분할 입력·BOM·fatal 처리를 추가했다.
- Event/EventTarget/DOMException, listener 객체·once/passive/capture·signal 취소를 추가했다.
  AbortSignal은 EventTarget을 상속하며 private 취소 우선순위와 기존 첫 예외 정책을 유지한다.
- 기본 Web Streams의 reader/writer/controller·잠금·역압력·Promise 완료·Transform·
  pipeTo/pipeThrough·tee·비동기 반복과 node:stream/web 별칭을 추가했다.
- Node Readable.toWeb/fromWeb과 fetch의 Web 스트림 업로드 입력을 연결했다.
  생성 실패·정상 종료·취소에서 reader lock을 회수한다.
- JSON reviver의 새 context와 정확한 source를 구현했다. wjson이 검증한 뒤 원래 UTF-16 span과
  초기 값을 대응시키며, 변경된 값에는 source를 주지 않는다. 입력 변환은 한 번이다.
- 새 Web 생성자의 함수 타입·new 호출 규칙을 연결하고 불필요한 import·ABI 선언·콜백 root를 정리했다.

Wave 정책·JSC 전용 실행·wjson JSON·원래 FD/Worker/애드온 수명 경계를 유지했다.
JS bootstrap·다른 엔진·CPU watchdog은 추가하지 않았다.
세부 지원 범위와 명시적 거부는 [호환 문서](docs/compatibility.md)를 따른다.

## 검증과 산출물

최신 헤더 수정과 HTTPS 회귀 추가 뒤 build와 독립 test 각각 **1055개·실패 0·네트워크 생략 0**,
Worker 종료 진단 **exit 0**이다. 두 명령 뒤 동일한 SHA-256을 확인했다.
앞선 ABI 변경 C/H의 clang-format --dry-run --Werror도 통과했다. 이번 분리에서는 C/H를 바꾸지 않았다.
독립 test의 워밍업 뒤 호스트 수명 16회에서 작업·root·스레드·FD 정리를 검사했다.
독립 test의 FD 기준은 5, RSS KiB 시작/최고/끝은 53996/54984/54984이었다.
최신 test-npm도 전체 1055개·실패 0·생략 0과 공개 npm 38개·실패 0이며,
API 앱에서 응답 쿠키 두 개의 실제 수신까지 검사했다.
TLS 검사 상대를 처음 추가한 실행에서는 기능 검사는 통과했지만 Go 캐시 정리 누락으로
1055개 중 정리 검사 1개가 실패했다. private 컴파일 캐시와 실행 파일 회수를 고친 뒤
위 최종 build·독립 test·test-npm에서 정리까지 통과했다.
장시간 안정성·전체 누수 부재의 증명은 아니다. 실제 TCP는 샌드박스 밖의 허용된 실행에서 검사했다.
샌드박스 안의 첫 --require-tcp 실행은 1039개 중 소켓 권한 2건 실패로 종료했고,
기존 runtime을 보존했다. 이를 HTTP 기능 실패나 성공한 외부 실행과 합산하지 않는다.

런타임: `target/native/jsrt`
SHA-256: `24dc102de3f7941291436b41ab5efc70e67a846b20f78d916cecb6368d88c531`.

앞선 Web 구현 때의 별도 JSC 진단: **91그룹·확인 38·차이 53·정상 대조군 실패 0**.
최신 Headers.getSetCookie 추가 뒤는 **91그룹·확인 39·차이 52·대조군 실패 0**이다.
별도 네트워크 진단의 기존 차이 3건은 해소됐고 엄격한 회귀를 HTTP 통합/실제 npm 앱에 연결했다.
수정 전에는 확인 6·차이 85였다. 그룹은 미지원 전역·모듈·묶음 메서드·의미 차이이며
버그/취약점 개수나 전체 호환 점수가 아니다. 기존 검사 수와 합산하지 않는다.
선택한 의미 점검에서 남은 차이는 숫자 timer의 ref/unref, file: URL, querystring.stringify다.

```sh
./bootstrap.sh build --engine-library target/engines/jsc-module-2.54.1/candidate-92596ae086a103c82a53c64b1c3c875a/libJavaScriptCore.so --require-tcp --probe-worker-termination
./bootstrap.sh test --engine-library target/engines/jsc-module-2.54.1/candidate-92596ae086a103c82a53c64b1c3c875a/libJavaScriptCore.so --require-tcp --probe-worker-termination
./target/native/jsrt tests/audit_matrix.js
```

검사 엔진: JSC 2.54.1 / Module·Synthetic ABI v1 / Worker ABI v2:
`target/engines/jsc-module-2.54.1/candidate-92596ae086a103c82a53c64b1c3c875a/libJavaScriptCore.so`.
구버전 허용은 사용하지 않았다. 실제 연결은 libcurl 8.18.0/OpenSSL 3.5.5,
libarchive 3.8.5, vendored libuv 1.53.0·llhttp 9.4.3이다.
--info에 새 기능과 Web 큐/대기 읽기 1024개·텍스트 입력 4 MiB 한도를 기록했다.

영구 회귀는 tests/web_regressions.js·tests/web_streams.js·tests/wjson.js에 있다.
실제 네트워크용 tests/io_network.js의 Web 업로드·응답 adapter·버퍼 본문 전송 검사는
실제 TCP로 통과했다. 필수 TCP 검증 없이 release를 발행하지 않는다.

앞선 Web 확장판에서 실제 release 명령도 실행했다. 필수 TCP의 socket() errno -1로 **1034개 중 2개 실패·생략 0**,
공개 npm HTTPS 검사는 **5개 중 1개 실패**로 exit 1이었다. Worker 종료 진단은 exit 0이다.
배포 게이트가 새 archive 발행을 막았고 당시 runtime hash(ece62a72…9704a7)와 이전 archive hash가
명령 전후 동일함을 확인했다. 이 결과는 2026-10-27의 이전 실패 기록이다.

2026-10-28의 새 release는 exit 0으로 완료했다. 일반 후보와 상대 RUNPATH의 배포용 후보 각각
전체 회귀 **1054개·실패 0·생략 0**, 공개 npm HTTPS **38개·실패 0**을 통과했다.
Worker 종료 진단 exit 0, 이동·깨끗한 환경의 실행·설치/재설치·업데이트/롤백·여섯 SIGKILL 경계의
복구·주입 I/O/실제 EFBIG·변조/링크/비관리 파일 거부·삭제 검사도 통과했다.
필수 60초 혼합 부하 검사는 61표본·559 batches·2237 lanes·73302016바이트 전송·
3584 Worker·896 abort를 완료하고 PASS였다. RSS KiB warm/peak/end는 55884/57840/52784,
관측 최대 지연은 2668 ms였다. 1시간/24시간 완료나 지연 목표 달성을 뜻하지 않는다.
자동 생성 도구·runner·배포 staging·부하 입력을 정리했고 target/tools/tests는 배포하지 않았다.

```sh
./bootstrap.sh release --engine-library target/engines/jsc-module-2.54.1/candidate-92596ae086a103c82a53c64b1c3c875a/libJavaScriptCore.so
```

## 외부 검증과 남은 범위

연결된 GitHub 저장소 목록은 비어 있고 로컬 .git/원격 URL이 없다.
CI 설정 3개와 실제 원격 실행을 구분한다. 이번 환경에는 actionlint가 없다.
운영 서명 키/신뢰 공개키와 원격 runner 정보는 제공되지 않았다.

새 로컬 검증 배포물:
`target/dist/jsrt-linux-x86_64-1b534d9ecd3a6755a84a1d240751e62b30a538c4bac99acf8258e31eb9a7f82e.tar.gz`
SHA-256: `b6560fea0f9ac94569660c715f55e9b4652bcbb625e731518fa82ff90b44eff8`.
아카이브 SHA-256과 sidecar의 일치 및 포함 파일 목록을 확인했다.
공개 업로드·운영 서명·새 원격 CI/VM 실행은 하지 않았다.
이 archive는 최신 중복 헤더 수정 전에 만든 이전 검증판이다. 현재 runtime의 해시와 다르며,
이번 후속 수정 뒤 새 release/부하 검사를 실행하거나 archive를 교체하지 않았다.

아래 이전 배포물도 삭제/교체하지 않았고 기존 해시를 다시 확인했다:
`target/dist/jsrt-linux-x86_64-63014a8dfd176c599d29392708b166b191e0dc1ba53bd43f3b9bea66696426da.tar.gz`
SHA-256: `285fc3ce2f5d7edd412252822fa50f67c063b1e1fa8ccc5724f38dc87c5a250d`.

TextDecoder의 다른 인코딩, byte/BYOB/transfer·codec stream, 네트워크 Response clone,
File·multipart 파싱, 추가 Node API는 남아 있다. [ROADMAP.md](ROADMAP.md)를 따른다.
사용자가 종료한 이전 약 54분 10초 부하는 1시간 완료가 아니며 24시간·실제 VM/정전 검증도 미완료다.
이번에는 장시간 soak를 재시작하지 않았다.
