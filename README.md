<p align="center"><img src="wave.svg" width="280" alt="Wave 로고"></p>

# jsrt

Wave로 구현하고 JavaScriptCore를 내장하는 JavaScript 런타임입니다.
JavaScript 파싱·실행·GC·JIT는 JSC가, 호스트 API와 실행 정책은 Wave가 담당합니다.
JSON.parse/JSON.stringify는 Wave의 wjson 어댑터를 사용합니다.

## 빌드와 실행

Wave 컴파일러와 표준 라이브러리, C/C++ 컴파일러, Linux 빌드 도구가 필요합니다.
JSC 기준선은 2.54.1입니다. HTTP 클라이언트에는 TLS·비동기 DNS를 지원하는
시스템 libcurl 8.13.0 이상이 필요합니다. libuv·llhttp는 고정 vendored 소스를 빌드합니다.
실제 TLS 통합 검사에는 Go 컴파일러도 필요합니다. Wave 테스트 도구가 독립 TLS 검사 상대만
컴파일하며 Go 코드가 런타임에 링크되지는 않습니다. 경로는 JSRT_GO로 지정할 수 있습니다.

새 clone에서의 전체 순서(엔진 빌드, 환경 변수, 흔한 실패)는 [docs/building.md](docs/building.md)를 따릅니다.
`target/`은 Git에 포함되지 않으므로 먼저 엔진 후보를 만들고 그 경로를 `ENGINE`에 지정합니다.

```sh
./bootstrap.sh engine-build        # 마지막 줄의 "Candidate engine: …/libJavaScriptCore.so"를 사용
export ENGINE=target/engines/jsc-module-2.54.1/candidate-<해시>/libJavaScriptCore.so
./bootstrap.sh build --engine-library "$ENGINE"
./bootstrap.sh test --engine-library "$ENGINE" --require-tcp
./target/native/jsrt --info
./target/native/jsrt app.js
./target/native/jsrt -e "console.log('hello')"
./target/native/jsrt --check app.js
```

build와 test는 전체 회귀를 검사하며 실패한 후보로 기존 실행 파일을 교체하지 않습니다.
`--require-tcp`는 실제 소켓 검사를 필수로 합니다. 선택적 npm 통합 검사는
`./bootstrap.sh test-npm --engine-library <path> --require-tcp`로 실행합니다.
생성 도구와 테스트 입력은 실행 후 정리하며 target/tools/tests를 배포하지 않습니다.

`./bootstrap.sh engine-build`는 동일 WebKitGTK 소스로 새 엔진 후보를 만듭니다.
ESM·Worker·structuredClone은 해당 엔진 ABI가 필요하며 실제 가능 여부는 `--info`에 나옵니다.
구버전 엔진은 명시적 `--allow-older-engine` 빌드에서만 허용하며 별도 표시·출력합니다.

## 구현 범위

| 영역 | 현재 제공하는 기능 |
| --- | --- |
| 실행 | JavaScript, CommonJS, 내장 모듈의 node: 별칭, 명시적 파일 test 명령 |
| ESM | 정적·동적 import, live binding·순환·캐시, top-level await, import.meta, 패키지 조건, CJS 기본 export·JSON·내장 모듈 연결 |
| 기본 API | Node식 console·util.inspect/format, Buffer 부분 API, EventEmitter, Timeout 객체(ref/unref)·setImmediate·queueMicrotask, util.callbackify·콜백 fs 일부, global·atob/btoa·performance.now, URL·URLSearchParams·Headers 부분 API |
| Web 기반 | UTF-8 TextEncoder/Decoder, Event·EventTarget·DOMException 부분 API, 기본 Web Streams·pipe·tee·비동기 반복 |
| process | argv·env·cwd·execPath·platform·arch·versions·exitCode, exit()·hrtime·uptime·memoryUsage·pid, beforeExit·exit·SIGTERM/SIGINT, stdin·stdout·stderr, nextTick |
| 파일 | 동기·Promise 파일 API, Dirent, FileHandle 부분 API, 파일 읽기·쓰기 스트림 |
| 스트림 | Readable·Writable·Duplex·Transform·PassThrough, object mode, UTF-8 setEncoding, 역압력, cork/uncork·writev, 생성자 signal, finished·pipeline |
| HTTP | libuv·llhttp 서버, keep-alive·스트리밍·I/O 기한, libcurl HTTP(S) 클라이언트·fetch·취소·스트리밍 업로드 |
| Web 본문 | Blob, 버퍼 기반 Request·Response와 clone, Response.json, FormData의 필드·Blob·multipart 인코딩 |
| 암호 | OS 난수, UUID, SHA-256/384/512, 증분 Hash/HMAC, timingSafeEqual |
| 병렬·프로세스 | 제한된 Worker·structuredClone, 절대경로 child_process.spawn·소유 PID 회수·inherit/pipe stdio |
| 패키지 | SemVer 부분 문법, frozen/offline 잠금, 캐시·정리, 관리 트리 교체·복구, optional·peer, 로컬 workspaces 스냅샷 |
| 애드온 | Wave 로더와 C++의 Node-API v1 부분 ABI |

정확한 API 차이는 [호환 범위](docs/compatibility.md), 설치 정책은
[INSTALLER.md](INSTALLER.md), 권한·소유권 경계는 [SECURITY.md](SECURITY.md)를 따릅니다.
전체 Node/Bun/npm/WHATWG 호환을 제공하지 않습니다.

## 스트림과 CLI

Duplex는 읽기 EOF와 쓰기 finish가 독립적입니다. Transform과 PassThrough는 Duplex를 상속하며
변환·flush·역압력을 유지합니다. `cork()`는 중첩되며 `uncork()`로 깊이가 0이 되거나 `end()`가
호출될 때 쓰기를 재개합니다. 여러 대기 쓰기는 `_writev(chunks, done)`로 묶을 수 있습니다.
생성자 `signal`은 private 취소 알고리즘으로 연결하고 종료 시 구독을 해제합니다.

`process.nextTick(callback, ...args)`는 Wave FIFO를 사용합니다. 일반 JS 진입에서 nextTick을
먼저 처리한 뒤 JSC가 Promise 작업을 처리합니다. Promise 작업에서 예약한 nextTick은 해당
체크포인트가 끝난 뒤 처리합니다. Promise 큐는 JSC 소유이며 JS bootstrap은 없습니다.

stdin은 Linux `/proc/self/fd/0`을 별도 nonblocking 파일 설명으로 열어 상속 FD의 플래그를
변경하지 않습니다. 소비가 시작된 동안만 루프를 유지합니다. Worker의 stdin 읽기는 거부합니다.
stdout/stderr는 상속 FD의 동기 Writable이며 그 FD를 닫지 않습니다.

```js
const child = require('child_process').spawn(
    process.execPath,
    ['worker.js'],
    {stdio: 'pipe'}
);
child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => console.log(chunk));
child.stdin.end('input');
```

spawn은 절대 실행 파일 경로와 명시적 `{stdio:'inherit'}` 또는 `{stdio:'pipe'}`를 받습니다.
pipe는 stdin·stdout·stderr 세 방향이며 close 이벤트는 소유 프로세스 회수와 파이프 종료 뒤 발생합니다.
shell·PATH 검색·IPC·stdio 배열·env/cwd·uid/gid·detached 옵션은 제공하지 않습니다.

## Web 본문

Blob은 입력 바이트를 복사하며 size·type·text·arrayBuffer·bytes·slice를 제공합니다.
Request·Response 생성자는 문자열·바이트·Blob·FormData의 버퍼 본문을 지원합니다.
본문 text/json/arrayBuffer 소비는 한 번이며, 소비 전 버퍼 본문을 clone할 수 있습니다.
null 본문은 소비 상태를 바꾸지 않습니다. Response.json은 캡처한 wjson stringify를 사용합니다.
fetch는 Request 입력과 Blob·FormData·Web ReadableStream 업로드를 받습니다.

현재 non-null Response.body는 호스트 Readable이며 Readable.toWeb/fromWeb으로 변환할 수 있습니다.
기본 ReadableStream/WritableStream/TransformStream과 node:stream/web을 제공합니다.
BYOB·네트워크 응답 clone·File·multipart 파싱과 전체 Fetch 적합성은 남아 있습니다.
FormData 반복자는 변경을 관찰하고 반환 pair는 복사본이며
Blob 필드를 조회하면 File 대신 해당 Blob을 반환합니다. 상세 차이는 호환 문서에 있습니다.
TextDecoder는 UTF-8을 지원하고 다른 인코딩은 명시적으로 거부합니다.
JSON.parse reviver의 context.source도 Wave/wjson 어댑터에서 처리합니다.

## 패키지와 배포

```sh
./target/native/jsrt install --project ./app
./target/native/jsrt install --project ./app --offline --replace
./target/native/jsrt cache prune --project ./app
```

설치 중 lifecycle scripts를 실행하지 않습니다. `--include-dev`는 루트 개발 의존성을 선택합니다.
workspaces는 프로젝트 상대 경로 또는 마지막 `/*` 패턴을 받아 관리 node_modules에 복사합니다.
원본으로 향하는 symlink를 만들지 않으며 잠금은 원본 파일 전체의 스냅샷 무결성을 기록합니다.
개발용 링크 방식이나 npm 전체 의존성 풀이를 뜻하지 않습니다.

캐시는 256 MiB·1024개이며 오래된 게시물부터 정리합니다. 미인식 사용자 파일은 보존합니다.
[배포 안내](docs/distribution.md)에 설치·재설치·롤백·삭제·Ed25519 서명 검사 명령이 있습니다.
CI 설정과 실제 실행 상태는 [docs/ci.md](docs/ci.md)를 따릅니다.

## 검증과 보안 경계

최종 검사 수·실행 엔진·산출물 해시와 생략 항목은 [IMPLEMENTATION.md](IMPLEMENTATION.md)에 기록합니다.
샌드박스 안에서는 소켓 생성이 제한됩니다. 2026-10-28에 샌드박스 밖의 실제 TCP 전체 검사
1,055개와 공개 npm HTTPS 검사 38개를 실패·네트워크 생략 없이 통과했습니다.
원격 CI/VM 실행과 새 공개 릴리스·운영 서명은 아직 수행하지 않았습니다.

일반 JS·Worker·애드온은 현재 프로세스 권한으로 실행됩니다. 샌드박스가 아닙니다.
`--memory-limit-mb`는 선택적 POSIX 가상 주소 공간 soft limit이며 RSS·JS 힙 제한이 아닙니다.
CPU watchdog이나 JS 실행 시간 제한은 없습니다. TLS peer·hostname 검증은 항상 유지합니다.
모든 호스트 한도와 실제 연결 라이브러리는 `--info`에서 확인합니다.

## 코드 구조

main.wave → app.run, CLI는 cli.wave, 실행 수명은 session.wave, API 설치·정리는 host.wave에 있습니다.
이벤트 루프는 event_loop.wave, 타이머 소유권은 timers.wave, process 작업은 관련 Wave 모듈에 있습니다.
C/C++은 엔진·네이티브 ABI 연결에 한정합니다. 빌드·검사·배포 조정도 Wave로 구현합니다.
자세한 경계는 [ARCHITECTURE.md](ARCHITECTURE.md), 다음 범위는 [ROADMAP.md](ROADMAP.md)를 따릅니다.
실제로 재현한 기존 API 오류와 미구현 항목은 [2026-10-27 점검](docs/implementation-audit-2026-10-27.md)에 정리했습니다.
