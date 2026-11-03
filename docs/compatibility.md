# 호환 범위

2026-10-27 후속 구현에서 GET Request 복사, Blob 바이트 뷰 변환, 오류 본문 clone,
Web receiver 검사, FormData 문자열 한도와 스트림 옵션 문제를 수정했다.
TextEncoder/Decoder·EventTarget·기본 Web Streams를 추가했다. 최종 검증은
[IMPLEMENTATION.md](../IMPLEMENTATION.md), 수정 전 진단은
[점검 기록](implementation-audit-2026-10-27.md)을 따른다. 전체 표준 적합성을 뜻하지 않는다.

2026-10-26 추가: 같은 고정 그래프를 조합한 API 앱과 CLI 앱 회귀를 등록했다.
API 앱은 Polka 경로·cookie 미들웨어·비동기 JSON 파일 읽기·다중 Set-Cookie·반복 요청·404를,
CLI 앱은 실제 argv의 minimist 해석·파일 읽기·lodash 선택·querystring 왕복을 검사한다.
2026-10-28에 샌드박스 밖에서 고정 그래프를 실제 npm HTTPS로 설치하고 두 앱의 실행을 통과했다.
공개 npm 검사는 38개·실패 0이다. 패키지 전체 테스트나 임의의 npm 앱 호환을 뜻하지 않는다.

같은 날 후속 헤더 수정과 TLS 검사 추가 뒤 전체 검사는 1055개·실패 0·네트워크 생략 0이었다.
HTTP 서버의 EOF/finish 조기 소켓 종료 수정 뒤 HEAD·204·keep-alive·스트리밍을 재검증했다.
Request 원본/clone·Blob·FormData의 실제 HTTP 업로드와 기존 Web Stream 업로드·응답 adapter를
검사했다. multipart는 중복 필드·한글·파일 바이트와 boundary의 일치를 확인한다.
독립 TLS 상대에서 HTTPS 바이트·Blob·Request·FormData·Web Stream 업로드와 느린 상대의 전송,
활성 응답 취소·downgrade 거부·과대 응답 헤더 실패/슬롯 회수도 확인했다.
TLS 진행 중 업로드의 중간 취소와 추가 동시성 조합은 별도 후속 검사다.

클라이언트 응답의 중복 헤더는 마지막 값으로 덮어쓰지 않는다. Node HTTP 응답은 Set-Cookie 배열,
Cookie의 세미콜론 결합, 일반 헤더의 쉼표 결합과 singleton 첫 값 보존을 적용한다.
Fetch Headers는 일반 중복 값을 결합하고 getSetCookie()로 각 쿠키를 조회한다. Expires 쉼표로
쿠키를 나누지 않는다. 복사·clone·set/append/delete·정렬된 live 반복·forEach에서도 행을 보존한다.
getSetCookie 배열과 iterator pair는 복사본이고 immutable 네트워크 Headers에서도 조회할 수 있다.
정규화된 응답 헤더는 16 KiB·64개 예산을 적용하며 반복 쿠키의 이름·행도 센다.

2026-10-24, JavaScriptCoreGTK 2.54.1에서 다음 고정 버전의 선택된 사례를 통과했다.
패키지 전체 테스트나 모든 API 호환을 뜻하지 않는다. 버전은 재현용이며 최신성·보안 인증이 아니다.

| 패키지 | 버전 | 실행 사례 |
| --- | --- | --- |
| cookie | 1.0.2 | 파싱·직렬화·HttpOnly |
| eventemitter3 | 5.0.1 | once·emit |
| fast-querystring | 1.1.2 | 한글·배열·숫자 왕복 |
| get-stream | 6.0.1 | 비동기 문자열·Buffer 수집 |
| kleur | 4.1.5 | 색상 비활성 체인 |
| lodash | 4.17.21 | cloneDeep·uniq·get |
| lodash-es | 4.17.21 | 실제 ESM 그래프·chunk·isEqual |
| minimatch | 9.0.5 | glob·brace 선택 |
| minimist | 1.2.8 | 숫자·boolean·위치 인자 |
| ms | 2.1.3 | 기간 파싱·표시 |
| picomatch | 4.0.2 | 재귀 glob·확장자 선택 |
| semver | 7.7.2 | 범위·최고 적합 버전 |
| polka | 0.5.2 | 실제 TCP·미들웨어·경로 인자·반복 쿼리·JSON 응답·기본 404 |

Polka의 trouter/@polka/url 그래프까지 포함해 전체 20개 버전·HTTPS URL·SHA-512를
tests/npm_compat.lock.wjson에 고정했다. 루트 패키지는 13종이다.
tests/npm_compat.package.json과 tests/npm_compat.js가 영구 입력이다.
`./bootstrap.sh test-npm --engine-library <path> --require-tcp`는 private 작업공간에
frozen 설치 후 실행하고 정리한다. 기존 설치기 검사와 합쳐 npm 검사 36개다.
잠금 갱신은 `./bootstrap.sh compat-lock --output <새 파일>`로 수행하며 기존 파일은 덮어쓰지 않는다.

Readable.setEncoding('utf8'/'utf-8')은 분할 UTF-8·BOM·잘못된 바이트·EOF·역압력·재진입을 검사한다.
문자열 큐 길이와 read(n)은 UTF-16 단위다. 다른 인코딩과 object mode의 setEncoding은 거부한다.
CJS 상대 import()는 percent-encoded file URL로 공백·%·#·한글 경로를 처리한다.
더 큰 HTTP/웹 패키지와 실제 native addon은 후속 확대 대상이다.

HTTP 응답의 getHeader/hasHeader/getHeaders/removeHeader와 writeHead(status, headers)를 추가했다.
헤더 이름은 대소문자를 구분하지 않고 getHeaders는 null prototype의 복사본이다.
삭제 슬롯 재사용·getter 첫 오류/재진입·헤더 확정 후 변경 거부를 검사한다.
2026-10-26에 setHeader의 문자열 배열과 writeHead(status, [name, value, ...])를 추가했다.
중복 raw 이름은 대소문자를 합쳐 배열로 보존하고 각 값을 개별 헤더 행으로 전송한다.
빈 배열은 전송할 행이 없으며 조회·삭제할 수 있다. 배열 입력과 조회 결과는 복사본이다.
Node의 원본 배열 참조/변경 의미와 다르며 숫자 값·사용자 reason phrase·runtime-managed framing
헤더는 여전히 지원하지 않는다. 응답 전체의 행 수 64개·헤더 바이트 16 KiB 한도를 적용한다.
STATUS_CODES는 기본 오류 처리에 필요한 공통 12개 코드의 부분 표다.
전체 ServerResponse 적합성을 뜻하지 않는다.

process는 platform/arch/versions.jsrt/versions.jsc와 EventEmitter, SIGTERM/SIGINT,
exit 이벤트, stdout/stderr Writable을 추가했다. stdio는 동기 descriptor write이고 fd를 닫지 않는다.
신호 콜백은 libuv에서 native 표식만 남기며 JS는 소유 main loop에서 실행한다. 신호 구독만으로
프로세스를 유지하지 않으며 Worker의 신호 구독은 거부한다. 2026-10-26에 beforeExit를 추가했다.
정상 유휴 시 현재 exitCode로 호출하며 예약된 타이머·파일·자식 프로세스가 끝난 뒤 다시 발생한다.
예외 종료에는 호출하지 않는다. nextTick/stdin은 아래 확장 범위를 제공하며 전체 process는 아니다.
util.inherits와 기본 구분자 querystring.parse/decode를 추가했다(stringify는 2026-11-03에 추가). querystring은 기존 Wave form decoder를
사용하며 입력 8191바이트/1024쌍 한도, 다른 구분자·options·stringify는 지원하지 않는다.

## 코어 전역·유틸리티 (2026-11)

**console / util.inspect / util.format.** console.log·info·debug는 stdout, error·warn은 stderr에 쓰며
모두 Node의 formatWithOptions를 따르는 Wave 포매터(runtime/inspect.wave, format.wave)를 거친다.
`%s %d %i %f %j %o %O %c %%`를 지원하고, 객체는 Node처럼 줄 폭 80·깊이 2·배열 100개 한도로 출력한다.
숫자 배열 열 맞춤, 순환 `<ref *1>`/`[Circular *1]`, Map/Set/배열/typed array/ArrayBuffer/Buffer/Date/
RegExp/Error(stack 줄을 `at` 형식으로 변환)/박싱 원시값/함수·클래스/null prototype/`Symbol.toStringTag`/
`[util.inspect.custom]`을 처리한다. 접근자는 `[Getter]`·`[Setter]`로만 표시하며 호출하지 않는다.
옵션은 depth·breakLength·maxArrayLength·maxStringLength만 읽고 나머지(colors, compact, sorted,
showHidden 등)는 무시한다. Proxy는 트랩을 실행하지 않고 `Proxy(<target unavailable>)`로 표시한다(Node는 대상을 출력하지만 엔진 ABI가 대상을 노출하지 않는다). 출력은 UTF-16 4Mi 단위, 중첩 256단계로 제한한다.
알려진 차이: `%o`의 showHidden 출력(`[length]`)과 Promise 상태(`Promise { <unknown> }`), WeakMap/WeakSet
내용, Proxy 대상, `[Arguments]`, Buffer의
`constructor.name`은 Uint8Array이므로 라벨을 고정 `<Buffer …>`로 표시한다.
출력은 tests/core_globals.js의 선택 사례와 설치된 Node의 출력을 대조했으며 전체 적합성 검사는 아니다.

**util.callbackify / 콜백 fs.** `util.callbackify`와 `fs.readFile·writeFile·stat·lstat·access·mkdir·unlink·
rmdir·rename·readdir`의 콜백 형태를 제공한다. 마지막 인자가 함수가 아니면 `ERR_INVALID_ARG_TYPE`을
동기적으로 던지고, 결과는 `process.nextTick`으로 전달한다. 거짓 거부 값은 `ERR_FALSY_VALUE_REJECTION`
오류로 감싼다. 콜백 형태의 open/close/read/write/appendFile 등은 아직 없다.

**util.deprecate / util.promisify.custom.** `util.deprecate(fn, message[, code])`는 래퍼를 돌려주고, 래퍼마다 첫 호출에서
한 번만 `(jsrt) [code] DeprecationWarning: message`를 stderr에 쓴 뒤 receiver와 인자를 그대로 전달한다. 함수가 아니면
`TypeError`, 문자열이 아닌 메시지는 첫 호출에서 `TypeError`다(Node와 같다). Node와 다른 점: `process.emitWarning`/`warning`
이벤트·`--no-deprecation`·code 단위 중복 제거가 없고 `new`로 호출하는 생성자 래핑을 따로 처리하지 않는다.
`util.promisify.custom`은 `Symbol.for('nodejs.util.promisify.custom')`이며 `fn[custom]`이 함수면 `promisify`가
그 함수를 그대로 돌려주고, 함수가 아닌 값이면 `TypeError`다. 회귀는 tests/core_modules.js(Node와 같은 결과).

**util.isDeepStrictEqual / process 식별 필드.** `util.isDeepStrictEqual(a, b)`는 `assert.deepStrictEqual`과 같은 비교기를
쓰며(순환 안전, 깊이 64·200만 단계 한도, 열거 가능한 Symbol 키 포함) 불리언을 돌려준다. 인자가 둘 미만이면 `TypeError`다.
`process.version`은 jsrt 자신의 버전(`v0.1.0-dev`)이며 Node 버전이 아니다. `process.versions`에는 일부러 `node` 항목이 없다.
`process.title`은 `jsrt`, `process.argv0`은 원래 `argv[0]`, `process.execArgv`는 빈 배열, `process.release`는 `{name: 'jsrt'}`다.
회귀는 tests/core_modules.js(공통 형태는 Node와 같고 jsrt 고유 값은 jsrt에서만 검사).

**타이머.** setTimeout·setInterval은 Timeout 객체를 반환하고 `ref`·`unref`·`hasRef`·`refresh`·`close`와
`Symbol.toPrimitive`(숫자 id)를 제공한다. 숫자 id와 객체 모두 clearTimeout/clearInterval에 쓸 수 있다.
`unref`된 타이머는 다른 작업이 남아 있으면 정상 실행하지만 그것만으로 이벤트 루프를 유지하지 않는다.
setImmediate/clearImmediate는 지연 0의 같은 타이머 저장소를 쓰며 Node의 check 단계와 정확히 같은
순서를 보장하지 않는다. 기존 1024개·인자 64개 한도를 공유한다.

**process.** `exit([code])`, `hrtime([prev])`/`hrtime.bigint()`, `uptime()`, `memoryUsage()`/`.rss()`,
`pid`, `ppid`를 추가했다. exit 코드는 exitCode와 같은 정수 0..255만 받는다(Node는 범위를 잘라 쓴다).
exit는 'exit' 이벤트를 실행하고 소유한 자식 프로세스와 Worker를 회수한 뒤 종료한다. 이후 JS는
실행되지 않지만 이미 열린 파일·소켓의 정리는 프로세스 종료에 맡긴다. Worker 안에서는 거부한다.
memoryUsage는 JSC C API가 힙 통계를 주지 않아 rss만 /proc/self/statm에서 읽고 heapTotal·heapUsed·
external·arrayBuffers는 0이다.

**전역.** `global`(globalThis 별칭), `performance.now()`/`timeOrigin`(다른 Performance API 없음),
`atob`/`btoa`(HTML 표준의 forgiving-base64, 실패 시 DOMException InvalidCharacterError)를 제공한다.

**2026-11-03 추가.** `querystring.stringify`/`encode`는 기본 구분자만 지원한다(공백은 `%20`, `!'()*~`는 유지,
문자열·유한 숫자·bigint·boolean 외 값은 빈 문자열, 배열은 키 반복, 쌍 한도는 URLSearchParams와 같다).
`process.chdir(path)`는 문자열만 받고 실패하면 현재 디렉터리를 유지하며 Worker 안에서는 거부한다. 실패 오류에는 파일 API와 같은 `code`·`errno`·`syscall`·`path`가 붙는다(ENOENT·ENOTDIR·EACCES 등).
작업 디렉터리는 프로세스 전체가 공유하므로 이미 대기 중인 상대 경로 비동기 파일 작업이 바뀐 디렉터리에서
실행될 수 있다. `assert.deepStrictEqual`/`notDeepStrictEqual`은 `Object.is`, 프로토타입, 태그, 열거 가능한 문자열 키,
Date·RegExp·원시 래퍼·Error·Map·Set·ArrayBuffer·typed array를 구조 비교한다. 순환은 지원하고
깊이 64·비교 200만 단계를 넘으면 RangeError다. 열거 가능한 own Symbol 키는 문자열 키처럼 비교하고(열거 불가 Symbol은 무시), WeakMap/Promise 내용은 비교하지 않고 같은 객체일 때만 같다.
`deepEqual`/`notDeepEqual`은 기존 `equal` 별칭처럼 엄격 비교와 같다(느슨한 비교가 아니다).
`timers/promises`는 `setTimeout`/`setImmediate`/`scheduler.wait`/`scheduler.yield`를 제공하며 옵션(signal·ref)을
주면 거부하고 setInterval 비동기 반복자는 없다. `timers`도 `setImmediate`/`clearImmediate`/`promises`를 노출한다.

아직 없는 것: `url.fileURLToPath`/`pathToFileURL`(URL이 file: 스킴을 표현하지 못함),
`process.kill`,
`net`/`tls`/`dns`/`zlib`/`readline`/`tty`/`async_hooks`/`perf_hooks`/`module`, `crypto.subtle`.

## 스트림·CLI 확장

Readable/Writable/Duplex/Transform/PassThrough 생성자의 signal을 private 취소 알고리즘에 연결한다.
이미 취소된 signal도 스트림을 destroy하며 error/close는 예약된 작업에서 발생한다.
정상 양면 완료 또는 destroy에서 구독을 해제한다. AbortError.cause는 원래 이유다.

Duplex의 읽기 EOF와 쓰기 finish는 독립적이다. Transform·PassThrough는 Duplex를 상속한다.
cork/uncork는 중첩 깊이를 관리하고 end는 cork를 해제한다. _writev는 대기 청크의 일반 배열과
단일 완료 콜백을 받으며 각 항목은 chunk/encoding을 가진다. 원래 write 콜백은 순서대로 완료한다.
allowHalfOpen:false는 읽기 end 뒤 쓰기를 끝낸다. 기본 autoDestroy는 지원하는 양면이 모두
완료된 뒤 destroy/close를 실행하며 autoDestroy:false로 끌 수 있다. HTTP 요청은 쓰기 finish 뒤에도
응답 전송 수명을 유지한다. UTF-8 encoding 생성자 옵션·readable 이벤트와 Duplex의
Writable instanceof 판정을 제공한다. Node Readable.from·async iterator·iterable pipeline과
Writable의 Web 변환은 아직 없다.

nextTick은 일반 CJS/eval·호스트 콜백 반환 시 Promise 작업보다 먼저 FIFO로 실행한다.
Promise 작업이 예약한 nextTick은 현재 엔진 체크포인트 뒤 처리한다.
대기 1024개·추가 인자 64개를 제한하며 JS bootstrap이나 호스트 Promise 큐는 사용하지 않는다.

process.stdin은 호스트 Readable이며 UTF-8 setEncoding을 제공한다. Linux procfs를 통해 별도
nonblocking 파일 설명을 사용하고 상속 FD를 닫거나 플래그를 변경하지 않는다. Worker 읽기·TTY/raw mode는 없다.
child_process.spawn은 명시적 stdio:'inherit' 또는 stdio:'pipe'를 받는다. pipe는 세 방향 모두 제공하며
exit와 close를 분리한다. stdio 배열·shell·PATH 검색·env/cwd·IPC 등은 거부한다.

## 버퍼 Web 본문

- Blob: iterable의 문자열·Blob·ArrayBuffer와 DataView를 포함한 ArrayBufferView 바이트를 복사한다.
  size/type/text/arrayBuffer/bytes/slice를 제공하며 전체 4 MiB·65536 parts, type 8191바이트를 제한한다.
  byteOffset/byteLength를 반영하며 클래스가 다른 getter/slice 호출을 거부한다. stream()은 아직 없다.
- Request: HTTP(S) URL 또는 기존 Request, method/headers/signal/body의 부분 생성자다.
  GET·HEAD 본문·URL 자격 증명과 TRACE 등 미지원 메서드를 거부한다.
  body 없는 Request 복사/clone을 지원하며 모든 Request는 기본 또는 dependent AbortSignal을 갖는다.
  본문은 문자열·바이트·Blob·FormData의 스냅샷이다.
- Response: status 200..599, headers와 버퍼 본문을 받는다. 204/205/304 본문과 사용자 statusText는 거부한다.
  text/json/arrayBuffer와 소비 전 버퍼 clone을 제공한다. null 본문은 null이고 반복 소비해도
  bodyUsed를 바꾸지 않는다. 실패한 본문의 clone은 원래 오류를 유지한다.
  메타데이터는 쓰기 불가이며 Response.json은 캡처한 wjson stringify를 쓴다.
- FormData: append/set/get/getAll/has/delete/forEach, entries/keys/values와 기본 반복자를 제공한다.
  최대 1024개 필드이며 문자열 값은 USVString으로 바꾼다. Blob 조회는 File 대신 원래 Blob을 반환한다.
  iterator는 이후 변경을 관찰하고 반환 pair는 복사본이다. forEach는 primitive thisArg를 보존한다.
  필드에는 URL 전용 8 KiB 제한을 적용하지 않으며 UTF-8·전체 multipart 4 MiB 제한을 적용한다.
  HTML form 생성자·File·multipart 파싱은 없다.
- Headers는 일반 iterable pairs를 받으며 기존 live iterator를 유지한다.
- fetch: Request 입력, Blob/FormData·Web ReadableStream 업로드와 본문에서 유도한 Content-Type을 연결한다.
  직접 생성한 Response의 Headers는 변경할 수 있고 네트워크 응답 Headers는 변경할 수 없다.

non-null Response.body는 호스트 Readable이다. Readable.toWeb/fromWeb으로 명시적으로 변환할 수 있다.
네트워크 Response clone, Request의 스트리밍 생성자와 나머지 Fetch 옵션·Body 메서드는 남아 있다.
위 버퍼/Web 본문은 실제 HTTP와 독립 TLS 상대의 HTTPS 전송을 확인했다.
모든 Fetch 옵션·취소 시점·전이 조합을 검증했다는 뜻은 아니다.

## 텍스트·이벤트·Web Streams

TextEncoder는 UTF-8 encode/encodeInto를 제공한다. encodeInto는 Unicode scalar를 중간에서
자르지 않고 읽은 UTF-16 단위·쓴 바이트 수를 반환한다. TextDecoder는 UTF-8 label·분할 입력·
DataView/typed view·BOM·fatal/ignoreBOM을 지원한다. 다른 인코딩 label은 RangeError다.
호출당 변환 버퍼 한도는 4 MiB다. TextEncoderStream/TextDecoderStream은 아직 없다.

Event/EventTarget/DOMException의 기본 생성자·listener 함수/handleEvent 객체·capture/once/passive·
signal 취소·dispatch·preventDefault·stopImmediatePropagation과 종료 상태 정리를 제공한다.
DOM 트리는 없으며 legacy event 필드·전체 DOM dispatch 적합성은 구현하지 않았다.
일반 EventTarget의 리스너 예외는 dispatch 뒤 기존 JSC microtask 오류 경로로 보고한다.
AbortSignal은 EventTarget을 상속하지만 기존 첫 예외 동기 전파 정책을 유지하며,
private 취소 알고리즘은 사용자 리스너보다 먼저 실행한다.

ReadableStream/WritableStream/TransformStream, default reader/writer/controller와
node:stream/web 별칭을 제공한다. 기본 source/sink/transform의 Promise 완료·직렬 쓰기·
highWaterMark/size·ready/closed·lock/release·cancel/abort·pipeTo/pipeThrough·tee·비동기 반복을 구현했다.
pipe 취소는 양쪽 완료를 기다리고 lock·signal 구독을 회수한다. tee의 느린 분기가 큐 한도를 넘으면
두 분기에 오류를 전달하고 원본을 취소한다. pending read·분기/쓰기 큐는 각각 최대 1024개다.
이 개수 제한은 청크에 담긴 임의 객체의 메모리까지 제한하지 않는다.

Node Readable.toWeb/fromWeb은 명시적 adapter다. 양쪽 소비 API를 동시에 사용하지 않는다.
fromWeb은 encoding/highWaterMark/objectMode/signal을 연결하며 종료·생성 실패 때 reader lock을 푼다.
fetch는 이 adapter로 Web 스트림을 기존 업로드 pipeline에 연결한다.
BYOB·byte stream 모드·stream transfer·추가 queuing strategy 클래스는 아직 지원하지 않는다.
전체 WHATWG/WPT 통과나 Node 스트림 전체 호환을 주장하지 않는다.

JSON.parse reviver는 새 context 객체를 받고 원래 primitive 값에는 정확한 context.source가 있다.
다른 콜백이 바꾼 값과 객체에는 source를 넣지 않는다. 지수·escape·signed zero를 보존하며
wjson 검증 뒤 원래 UTF-16 입력의 span만 인덱싱한다. 엔진 JSON fallback은 사용하지 않는다.

## 패키지 그래프

로컬 workspaces는 명시 경로/마지막 /* 패턴의 관리 스냅샷이며 개발용 symlink가 아니다.
원본 전체의 무결성을 잠그고 frozen/offline에서 소스 변경을 거부한다. 자세한 정책은 INSTALLER.md를 따른다.
누락 peer는 같은 부모 범위에 기록된 범위의 교집합에서 고른다. 이미 보이는 충돌은 실패하며
그래프 backtracking·전역 hoisting·추가 optional subtree 충돌 풀이는 아직 없다.
