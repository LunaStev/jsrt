# 구현 잔여 항목 점검 — 2026-10-27

후속 구현에서 아래 P1-1~6과 추가 Web 의미 차이·JSON reviver 원문 전달을 수정했다.
TextEncoder/Decoder·EventTarget·기본 Web Streams·pipe/tee/비동기 반복·Readable adapter도 추가했다.
아래 표와 1,027개/91그룹 결과는 **수정 전 점검 기준**이다. 현재 지원 범위와 최종 재검증은
[IMPLEMENTATION.md](../IMPLEMENTATION.md), 남은 구현은 [ROADMAP.md](../ROADMAP.md)를 따른다.
진단 입력은 유지했으며 같은 명령으로 개선 전후를 비교할 수 있다.
후속 JSC 재실행은 91그룹·확인 38·차이 53·대조군 실패 0이다.
숫자 timer의 ref/unref, file: URL, querystring.stringify는 선택한 의미 점검에서 여전히 미지원이다.

## 결론과 범위

기존 전체 회귀는 통과하지만 구현이 끝난 상태는 아니다. **새 기능을 늘리기 전에 이미 제공하는
Request/Response·Blob·FormData·스트림의 잘못된 동작부터 고쳐야 한다.**
아래는 소스·현재 문서·미지원 오류를 교차 확인하고 실제 JSC에서 재현한 작업 목록이다.
모든 표준·모든 npm 패키지를 전수 검증했다는 의미는 아니다.

최초 점검은 런타임 변경 없이 수행했고, 이후 사용자의 구현 요청에 따라 수정·확장했다.
샌드박스·CPU 제한·다른 엔진·엔진 JSON fallback은 새 작업에 포함하지 않는다.

## 실제 검증

| 검사 | 이번 결과 |
| --- | --- |
| 전체 회귀 | 1,027개, 실패 0, 실제 네트워크 2묶음 생략 |
| Worker 종료 진단 | exit 0 |
| 별도 API 진단 | 91개 진단 그룹, 확인 6, 차이 85, 정상 동작 대조군 실패 0 |
| 엔진 | JavaScriptCoreGTK 2.54.1, 프로젝트 Worker ABI v2 |
| 호스트 수명 16회 | FD 기준 5, RSS KiB 시작/최고/끝 53,696 / 54,328 / 54,328 |
| 실행 파일 SHA-256 | `5f8b4a79b062d221651b089cb9bb919d798df3380d44b7874db183ecf76d23e7` |

**85는 버그나 취약점 85개라는 뜻이 아니다.** 없는 전역·모듈, 여러 메서드를 묶은 항목,
명시적 부분 구현, 실제 의미 오류가 함께 포함된 진단 그룹 수다.
진단 스크립트의 exit 0은 대조군이 정상이라는 뜻이며 호환성 통과 선언이 아니다.
정상 대조군은 Blob 입력 스냅샷, non-null Response의 중복 소비 거부,
호스트 콜백의 nextTick 순서, 사용자 리스너보다 먼저 실행되는 abort다.
Headers의 live iterator와 URL의 percent-encoded dot segment 정규화도 정상으로 확인했다.

```sh
./bootstrap.sh test --engine-library target/engines/jsc-module-2.54.1/candidate-92596ae086a103c82a53c64b1c3c875a/libJavaScriptCore.so --probe-worker-termination
./target/native/jsrt tests/audit_matrix.js
```

[영구 진단 입력](../tests/audit_matrix.js)은 실행 결과를 표준 출력으로 내보내며 별도 파일을 만들지 않는다.
기존 회귀 검사 수에는 이 진단 그룹을 합산하지 않는다. 전체 회귀 뒤 생성 runner는 정리됐다.
16회 수명 검사는 장시간 안정성이나 누수 부재를 보장하지 않는다.

## 1. 먼저 수정할 기존 동작

여기서 P1은 작업 순서이며 CVSS나 보안 취약점 등급이 아니다.

| 우선 | 재현된 문제 | 현재 동작 / 수정 완료 조건 | 담당 소스 |
| --- | --- | --- | --- |
| P1-1 | body 없는 GET Request 복사 | `new Request(new Request('https://example.invalid/'))`가 GET/HEAD body 오류. null body를 빈 Buffer와 구분하고 GET/HEAD 복사·clone·fetch를 회귀 검사 | runtime/web_objects.wave:134, :344 |
| P1-2 | Blob의 바이트 변환 | DataView는 `[object DataView]` 문자열, Uint16Array([258])는 2바이트 대신 문자열 길이 3. 모든 ArrayBufferView의 byteOffset/byteLength를 복사하고 getter 예외·분리 버퍼·재진입도 검증 | runtime/web_objects.wave:134 |
| P1-3 | 실패한 Response 본문 clone | body.destroy(error) 뒤 clone().text()가 원래 오류 대신 저장된 "x"를 돌려줌. 오류·소비·잠금·파괴 상태와 clone 소유권을 일관되게 처리 | runtime/web_objects.wave:569, runtime/body_collect.wave |
| P1-4 | Web 클래스 receiver 검사 | Blob getter/slice에 Response, Response.clone에 Blob을 넣어도 3개 모두 거부하지 않음. 메서드·getter별 class brand를 검사하고 TypeError 보장 | runtime/web_objects.wave:396, :569 |
| P1-5 | FormData의 숨은 문자열 한도 | 8,192자 필드가 UTF-8 한도 오류. multipart 4 MiB 예산과 URL 전용 8 KiB 변환 한도를 분리하고 한계값·UTF-8·첫 예외 검증 | runtime/form_data.wave:62, runtime/url_core.wave:36 |
| P1-6 | 받아 놓고 무시하는 스트림 옵션 | encoding:'utf8'에도 Buffer, allowHalfOpen:false에도 writable 미완료. 지원하면 정확하게 적용하고 미지원이면 명시적으로 거부 | runtime/stream*.wave |

오류 clone 재현은 로컬 버퍼 Response에 한정한다. 네트워크 Response clone은 원래 미지원이다.
Request URL credentials는 생성자가 받아들이지만 fetch의 별도 검증은 존재한다.
이번 결과만으로 자격 증명 유출이나 native 메모리 취약점이 확인됐다고 해석하지 않는다.

## 2. 기존 API의 추가 의미 차이

| 영역 | 실제 확인된 차이 / 필요한 작업 |
| --- | --- |
| Request | 기본 signal이 undefined. 전달한 signal의 dependent 사본 대신 같은 객체를 사용. pre-aborted GET fetch도 bodyUsed를 true로 바꿈 |
| Response | null body가 host Readable이 되고 소비 뒤 bodyUsed=true·재소비 거부. status 등 metadata가 쓰기 가능하며 private 상태와 분리될 수 있음 |
| Blob | 일반 iterable parts 거부, Symbol.toStringTag 미설정 |
| Headers | Map 등 일반 iterable pairs 입력을 조용히 누락. getSetCookie 없음 |
| FormData | iterator가 snapshot이라 이후 append를 관찰하지 않음. forEach의 strict primitive thisArg가 boxing됨 |
| 스트림 | readable 이벤트만으로 읽기가 진행되지 않음. 기본 autoDestroy 의미 미구현. Duplex instanceof Writable=false |
| 타이머 | 숫자 ID만 제공, ref/unref 없음. immediate·Promise 타이머 모듈 없음 |
| JSON | reviver 세 번째 인자 context.source가 undefined. 원문 숫자를 wjson 트리/호스트 어댑터에서 보존해야 하며 엔진 parse fallback으로 우회하지 않음 |
| URL | 현재 HTTP/HTTPS만 허용. file: URL·관련 파일 경로 변환은 미구현 |
| querystring | stringify/escape/unescape 없음. 현재 encode/decode API와 구분 |

위 Body 의미는 [Fetch Body mixin](https://fetch.spec.whatwg.org/#body-mixin),
스트림 의미는 [Node stream 문서](https://nodejs.org/api/stream.html),
reviver 원문 전달은 [ECMAScript JSON.parse](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.parse)를 기준으로 비교했다.
부분 Node API 전체를 즉시 구현해야 한다는 뜻은 아니지만 지원하지 않는 옵션을 성공으로 받아들이는 동작은 정리해야 한다.

## 3. 없는 API — 실제 presence 검사

### 전역과 모듈

없는 전역 22개:
ReadableStream, WritableStream, TransformStream, TextEncoder, TextDecoder,
TextEncoderStream, TextDecoderStream, File, Event, EventTarget, DOMException,
CompressionStream, DecompressionStream, MessageChannel, MessagePort, WebSocket,
performance, crypto, setImmediate, clearImmediate, atob, btoa.

없는 node: 모듈 14개:
stream/web, timers/promises, net, tls, dns, dns/promises, http2, zlib,
async_hooks, perf_hooks, readline, tty, module, test.

### 기존 모듈의 빠진 메서드

아래는 진단 입력에서 실제 missing으로 나온 항목만 기록한다.
예를 들어 os.availableParallelism, Buffer.compare/toJSON은 존재하므로 누락으로 계산하지 않는다.

| 진단 그룹 | 없는 메서드 |
| --- | --- |
| fs.sync | `openSync`, `closeSync`, `readSync`, `writeSync`, `copyFileSync`, `cpSync`, `rmSync`, `chmodSync`, `chownSync`, `mkdtempSync`, `readlinkSync`, `symlinkSync`, `watch` |
| fs.promises | `copyFile`, `cp`, `rm`, `chmod`, `chown`, `mkdtemp`, `readlink`, `symlink`, `watch`, `realpath` |
| fs.callbacks | `readFile`, `writeFile`, `stat`, `readdir`, `open`, `close` |
| stream.readable | `from`, `fromWeb`, `toWeb` |
| stream.prototype | `unshift`, `isPaused`, `wrap`, `iterator`, `map` |
| crypto.functions | `pbkdf2`, `scrypt`, `generateKeyPair`, `createSign`, `createVerify`, `createCipheriv`, `createDecipheriv`, `createSecretKey`, `getHashes` |
| util.functions | `format`, `inspect`, `callbackify`, `deprecate` |
| assert.functions | `deepStrictEqual`, `notDeepStrictEqual`, `rejects`, `doesNotReject`, `match` |
| path.functions | `toNamespacedPath`, `matchesGlob` |
| url.functions | `fileURLToPath`, `pathToFileURL`, `domainToASCII`, `domainToUnicode` |
| os.functions | `cpus`, `networkInterfaces`, `userInfo` |
| process.functions | `exit`, `chdir`, `hrtime`, `uptime`, `memoryUsage`, `kill` |
| http.functions | `Agent`, `Server`, `ServerResponse`, `IncomingMessage` |
| worker.functions | `MessageChannel`, `MessagePort`, `markAsUntransferable` |
| querystring.functions | `stringify`, `escape`, `unescape` |
| buffer.functions | `swap16`, `swap32`, `swap64` |
| headers.functions | `getSetCookie` |
| response.functions | `blob`, `bytes`, `formData` |
| response.static | `error`, `redirect` |
| blob.functions | `stream` |

추가로 Readable의 Symbol.asyncIterator와 util.promisify.custom이 없다.
이 표는 선택한 표면의 조사이며 모든 overload·property·실패 의미까지 확인한 표는 아니다.

## 4. 구조적으로 남은 구현과 검증

| 영역 | 남은 범위와 완료 조건 |
| --- | --- |
| Web 기반 | TextEncoder/Decoder·Event/EventTarget/DOMException부터 구현하고 WHATWG Streams·reader/writer lock·cancel·backpressure·tee로 연결. 기존 host Readable과 adapter를 명시 |
| fetch·본문 | 실제 네트워크 업로드/다운로드 취소·역압력·redirect·TLS 실패, Web Streams body와 네트워크 clone/tee, File·multipart 파싱, 나머지 Request/Response 옵션·속성 검증 |
| HTTP | 독립 net/tls/dns와 서버 TLS, upgrade/WebSocket·HTTP/2·압축 등. 클라이언트 response_headers는 같은 이름에 put하므로 중복 Set-Cookie 보존을 별도 수정/실제 TCP 재현해야 함 |
| 파일 | callback fs, FileHandle overload·readv/writev·권한·watch·스트림, fs sync/promises 확장. fd 전이·작업 직렬화·join 순서를 유지 |
| process·자식 | TTY/raw mode·stdio 배열·IPC·env/cwd 등. 현재 spawn의 미지원 옵션 거부와 소유 PID 회수를 유지하며 shell을 자동 활성화하지 않음 |
| 모듈 | ESM 자체는 구현됨. require(ESM), CJS named export 추론, 추가 resolver 조건·호환 사례가 남음. runtime/modules.wave의 “ES modules are not implemented” 오류는 실제로 require(ESM) 제한을 뜻하므로 문구 수정 필요 |
| 패키지 | 일반 glob·nested/linked workspaces·workspace devDependencies 정책, 그래프 backtracking·전역 hoisting·추가 optional/peer 충돌 및 rollback, npm lock 연계·private registry/auth·bin. lifecycle scripts는 현재 의도적 비활성 정책이므로 자동 활성화하지 않음 |
| Worker | MessageChannel/Port·transfer list·SAB·추가 structured clone 형식·nested Worker 정책. raw JS handle 공유로 구현하지 않음 |
| Node-API | 현재 v1 부분 ABI의 실제 SDK 사례를 늘리고 필요한 심볼만 점진 확장. 전체 ABI 지원으로 표시하지 않음. root/context/library 폐기 순서를 유지 |
| crypto·유틸 | Web Crypto·KDF·서명·암복호화, util/assert/path/Buffer의 필요한 표면과 실패 의미 |
| 개발·플랫폼 | REPL·watch·source map·디버거·프로파일러·벤치마크·타입 선언, 다른 아키텍처와 macOS/Windows의 ABI·빌드·실행. Linux 사용자 공간 검증을 다른 커널 검사로 계산하지 않음 |

HTTP 중복 헤더 항목은 소스 확인이며 이번 환경에서 네트워크 재현을 완료하지 못했다.
표의 나머지 구조적 항목은 현재 미지원 선언·코드 범위의 점검이며 모두 개별 동작을 재현한 것은 아니다.

## 5. 보안 의존성·배포 게이트

- JSC 기준선은 계속 **2.54.1**이다. [2.54.2는 2026-10-23 공개된 수정 릴리스](https://webkitgtk.org/2026/10/23/webkitgtk2.54.2-released.html)다.
  공개 릴리스 설명만으로 현재 JSCOnly의 취약점을 확정할 수 없다.
  별도 후보에 프로젝트 Module/Synthetic/Worker/Clone ABI 패치를 이식하고 심볼·전체 회귀·실제 네트워크를 검증한 후 채택한다.
- 실제 패키지는 libcurl4t64 **8.18.0-1ubuntu2.8**, libssl3t64 **3.5.5-1ubuntu3.7**,
  libarchive13t64 **3.8.5-1ubuntu2.3**이다. --info의 upstream 숫자만으로 취약 여부를 판정하면 안 된다.
- [curl HTTP/2 upload UAF CVE-2026-92392](https://curl.se/docs/CVE-2026-92392.html)와
  [TLS 재사용 CVE-2026-4873](https://curl.se/docs/CVE-2026-4873.html)는 upstream 8.18.0에 해당하는 경고지만,
  설치 패키지의 changelog.Debian.gz에는 두 수정 패치가 포함돼 있다.
  전자는 현 버전 .8, 후자는 .1에 기록돼 있다. 취약 upstream 버전표를 현 실행 파일의 확정 취약점 수로 옮기지 않는다.
- OpenSSL·libarchive changelog에도 보안 backport가 있다. vendored libuv 1.53.0·llhttp 9.4.3은
  [libuv advisory](https://github.com/libuv/libuv/security/advisories)와
  [llhttp advisory](https://github.com/nodejs/llhttp/security/advisories)를 확인했다.
  이번 열람은 전체 의존성 SBOM·모든 CVE 적용성 분석·exploit 검사 완료가 아니다.
  배포 게이트에는 정확한 배포판 revision, 동적 링크 경로, upstream advisory/패치 대응표를 남겨야 한다.
- 현재 세션의 DNS/TCP 제한으로 실제 업로드·TLS·npm 새 앱 2개는 미검증이다.
  네트워크 허용 runner에서 build/test --require-tcp와 test-npm --require-tcp를 완료해야 한다.
- 로컬 .git·원격 URL·runner 연결이 없다. CI 파일 3개는 구현돼 있지만 실제 원격 실행 기록은 없다.
  이번 환경에는 actionlint가 없어 새 lint 통과로 기록하지 않는다.
- 이번 binary의 새 배포 archive·운영 서명·설치/재설치/삭제 검증은 아직 없다.
  기존 배포물은 이번 Web/stream/CLI/workspace 기능 이전 버전이다.
- 54분 10초에서 사용자 종료한 이전 부하는 1시간 완료가 아니다. 24시간·물리 정전·디스크 고장 검증도 미완료다.
  이번 점검은 장시간 부하를 재시작하지 않았다.

## 진행 순서와 완료 판단

1. P1-1~6을 고치고 각 재현을 실패를 잡는 영구 회귀로 전환한다. 기존 의미 차이도 API별로 처리한다.
2. 기본 Web 변환·이벤트·Streams를 구현하고 기존 stream/fetch를 연결한다.
3. 목표 앱이 실제 요구하는 파일·네트워크·process·패키지 API를 선택해 넓힌다.
4. 네트워크 허용 환경에서 통합·새 npm 앱·의존성 패치 상태와 CI를 실제 검증한다.
5. 최종 build와 독립 전체 test가 모두 통과한 동일 hash만 새 archive·서명·설치 검증 대상으로 삼는다.

누락 API를 모두 구현해야만 쓸 수 있다는 뜻은 아니다. 배포 전에 먼저 바로잡을 것은
기존 기능의 데이터 변환·실패 전파·옵션 처리와 아직 수행하지 못한 실제 I/O 검증이다.

