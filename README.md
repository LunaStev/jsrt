<p align="center"><img src="wave.svg" width="280" alt="Wave 로고"></p>

# jsrt

**Wave로 구현한 JavaScript 런타임.** JavaScriptCore(JSC)를 내장하고, 모듈 해석·이벤트 루프·타이머·
파일/네트워크 정책 같은 호스트 쪽은 Wave 언어로 작성했습니다.

> **상태: 개발 중입니다.** 핵심 기능과 회귀 검사는 갖췄지만 Node.js·Bun·npm·WHATWG와의
> 전체 호환을 제공하지 않으며, 샌드박스도 아닙니다. `jsrt`는 임시 기술 이름입니다.
> 지원 범위와 차이는 [호환 범위](docs/compatibility.md)가 기준입니다.

```sh
$ jsrt -e "console.log([1, 2, 3].map(n => n * 2))"
[ 2, 4, 6 ]
```

## 역할 분담

| 담당 | 내용 |
| --- | --- |
| JavaScriptCore | JavaScript 파싱·실행·GC·JIT, Promise 작업 큐 |
| Wave (호스트 대부분) | JS API, 모듈 해석, 이벤트 루프, 타이머, Worker·파일·네트워크 정책, 패키지 설치, 빌드·테스트 도구 |
| wjson | `JSON.parse` / `JSON.stringify` (Wave 어댑터, 엔진 JSON 폴백 없음) |
| libuv · llhttp | HTTP 서버 소켓과 파서(고정 vendored 소스, 프로토콜 정책은 Wave) |
| libcurl | HTTP(S) 클라이언트 (TLS peer·hostname 검증 항상 유지) |
| C / C++ | 엔진·Node-API ABI 연결에 한정 (JSC 모듈 로더 브리지 포함) |

JS 부트스트랩 코드나 별도 Promise 작업 큐는 없습니다. 코드의 대부분은 Wave입니다.

## 제공하는 기능

| 영역 | 내용 |
| --- | --- |
| 실행 | JavaScript, CommonJS, `node:` 별칭, ESM(정적·동적 import, live binding, top-level await, `import.meta`, 패키지 조건) |
| 콘솔·유틸 | `console`, `util.inspect/format/inherits/promisify/callbackify/deprecate`, `promisify.custom`, `querystring`, `assert`(`deepStrictEqual` 포함) |
| 타이머·프로세스 | `setTimeout/Interval/Immediate`(Timeout 객체, ref/unref), `timers/promises`, `queueMicrotask`, `process`(argv·env·cwd·`chdir`·exit·hrtime·stdio·nextTick·신호) |
| Web | URL·URLSearchParams, Headers, Blob, FormData, Request/Response, `fetch`, UTF-8 TextEncoder/Decoder, Event·EventTarget, 기본 Web Streams, AbortController |
| 파일·스트림 | 동기·Promise·콜백 `fs` 일부, FileHandle, 파일 스트림, Readable·Writable·Duplex·Transform·`pipeline` |
| 네트워크 | HTTP 서버(keep-alive·스트리밍·I/O 기한), HTTP(S) 클라이언트·취소·스트리밍 업로드 |
| 병렬·프로세스 | 제한된 Worker·`structuredClone`, `child_process.spawn`(절대경로, inherit/pipe) |
| 암호 | OS 난수, UUID, SHA-2, Hash/HMAC, `timingSafeEqual` |
| 패키지·애드온 | `jsrt install`(frozen/offline 잠금, 캐시, 트리 교체·복구), Node-API 부분 ABI |

이름만 있는 항목은 부분 구현일 수 있습니다. 메서드·옵션 단위의 정확한 차이는
[docs/compatibility.md](docs/compatibility.md)에 있습니다.

## 시작하기

필요한 것: Wave 컴파일러와 표준 라이브러리, C/C++ 컴파일러, `cmake`·`ninja`, 시스템 libcurl 8.13.0 이상
(TLS·비동기 DNS), OpenSSL. 실제 TLS 통합 검사에는 Go 컴파일러가 추가로 필요합니다(검사 상대만 컴파일하며
런타임에는 링크되지 않습니다). 새 clone에서의 전체 순서와 흔한 실패는 [docs/building.md](docs/building.md)를 따르세요.

```sh
./bootstrap.sh engine-build        # JSC 2.54.1 후보 빌드, 마지막 줄의 경로를 사용
export ENGINE=target/engines/jsc-module-2.54.1/candidate-<해시>/libJavaScriptCore.so

./bootstrap.sh build --engine-library "$ENGINE"
./bootstrap.sh test  --engine-library "$ENGINE" --require-tcp
```

- JSC 기준선은 **2.54.1**입니다. 더 오래된 엔진은 기본 거부하며, `--allow-older-engine` 빌드는 별도로 표시됩니다.
- `build`와 `test`는 전체 회귀를 통과해야만 실행 파일을 게시합니다. 실패하면 이전 실행 파일이 남습니다.
- `target/`은 Git에 포함되지 않습니다.

## 사용법

```sh
jsrt app.js [args...]        # 파일 실행 (jsrt run app.js 와 같음)
jsrt -e "console.log(1+1)"   # 스크립트 실행
jsrt --check app.js          # 문법 검사
jsrt test a.test.js b.test.js  # 파일별 격리 프로세스에서 순차 실행
jsrt --info                  # 실제 엔진·라이브러리 버전과 호스트 한도
jsrt --memory-limit-mb 512 app.js
```

```js
// server.js
const http = require('http');
http.createServer((req, res) => res.end('hello\n')).listen(3000);
```

패키지 설치는 lifecycle scripts를 실행하지 않습니다.

```sh
jsrt install --project ./app
jsrt install --project ./app --offline --replace
jsrt cache prune --project ./app
```

## 검증 상태

- 2026-11-04: build와 독립 `test`(실제 TCP·Worker 종료 진단 포함) 각각 **1060개 통과, 실패 0, 생략 0**.
- 이전 실행에서 공개 npm HTTPS 검사 38개, Valgrind, 2시간 soak를 통과했습니다. 지연 수치는 SLO가 아닙니다.
- **아직 하지 않은 것**: 원격 CI/VM 실행(워크플로 파일만 있음), 운영 서명, 24시간 부하, 깨끗한 환경의 엔진 전체 재컴파일.

최종 검사 수·엔진·산출물 해시와 생략 항목은 [IMPLEMENTATION.md](IMPLEMENTATION.md)에, CI 상태는 [docs/ci.md](docs/ci.md)에 기록합니다.

## 알려진 한계

- Node.js·Bun·npm·WHATWG 전체 호환이 아닙니다. 아직 없는 대표 항목: `net`/`tls`/`dns`/`zlib`/`readline`/`tty`,
  WebSocket, BYOB 스트림, `MessageChannel`, `require(ESM)`, `file:` URL, REPL·디버거.
- `assert.equal`/`deepEqual`은 엄격 비교의 별칭입니다.
- 일반 JS·Worker·애드온은 현재 프로세스 권한으로 실행됩니다. 샌드박스가 아닙니다.
- `--memory-limit-mb`는 POSIX 가상 주소 공간 soft limit이며 RSS·JS 힙 제한이 아닙니다.
- CPU watchdog이나 JS 실행 시간 제한은 없습니다.
- Node-API는 구현한 `napi_*`만 내보내며 전체 지원을 주장하지 않습니다.

남은 작업 목록은 [ROADMAP.md](ROADMAP.md)입니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/building.md](docs/building.md) | 깨끗한 소스에서 빌드하기 |
| [docs/compatibility.md](docs/compatibility.md) | API별 지원 범위와 Node와의 차이 |
| [ARCHITECTURE.md](ARCHITECTURE.md) · [docs/structure.md](docs/structure.md) | 모듈 경계와 소유권 |
| [SECURITY.md](SECURITY.md) | 권한·보안 경계 |
| [INSTALLER.md](INSTALLER.md) · [docs/distribution.md](docs/distribution.md) | 설치 정책, 배포·서명 검사 |
| [docs/engine-source.md](docs/engine-source.md) · [docs/engine-validation.md](docs/engine-validation.md) | 엔진 소스와 검증 |
| [ROADMAP.md](ROADMAP.md) | 남은 범위 |

## 라이선스

[Mozilla Public License 2.0](LICENSE). `vendor/` 아래 의존성은 각자의 라이선스를 따릅니다.
