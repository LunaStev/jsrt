<p align="center"><img src="wave.svg" width="280" alt="Wave 로고"></p>

# jsrt

Wave로 구현하고 JavaScriptCore(JSC)를 내장한 JavaScript 런타임입니다.

> **개발 중입니다.** Node.js·Bun·npm·WHATWG 전체 호환이 아니며 샌드박스도 아닙니다.
> `jsrt`는 임시 이름입니다. 지원 범위와 차이는 [docs/compatibility.md](docs/compatibility.md)를 따릅니다.

## 구조

- **JavaScriptCore**: JS 파싱·실행·GC·JIT, Promise 작업 큐
- **Wave**: JS API, 모듈 해석, 이벤트 루프, 타이머, 파일·네트워크·Worker 정책, 패키지 설치, 빌드 도구
- **wjson**: `JSON.parse` / `JSON.stringify`
- **libuv · llhttp · libcurl**: HTTP 서버/클라이언트 (TLS 검증 항상 유지)
- **C / C++**: 엔진·Node-API ABI 연결에 한정

## 제공하는 것

CommonJS와 ESM, `console`/`util`/`assert`/`events`/`path`/`os`/`url`/`querystring`, 타이머(`timers/promises` 포함),
`process`, `fs`(동기·Promise·콜백 일부), 스트림과 기본 Web Streams, `fetch`·`Request`·`Response`·`Blob`·`FormData`,
HTTP 서버/클라이언트, 제한된 Worker·`child_process.spawn`, 암호 일부(해시·HMAC·난수), `jsrt install` 패키지 설치,
Node-API 부분 ABI. 각 항목은 부분 구현일 수 있습니다.

## 빌드와 실행

Wave 컴파일러, C/C++ 컴파일러, `cmake`·`ninja`, libcurl 8.13.0 이상이 필요합니다. 자세한 순서는
[docs/building.md](docs/building.md)를 따르세요. JSC 기준선은 2.54.1입니다.

```sh
./bootstrap.sh engine-build                       # 엔진 후보 빌드, 마지막 줄의 경로 사용
./bootstrap.sh build --engine-library <libJavaScriptCore.so 경로>

jsrt app.js            # 파일 실행
jsrt -e "console.log(1 + 1)"
jsrt --info            # 엔진 버전과 호스트 한도
```

이 공개 저장소에는 테스트 소스(`tests/`)가 포함되어 있지 않습니다. 빌드의 전체 회귀 검사와 `test` 명령은
테스트 소스가 있는 작업 트리에서만 실행됩니다.

## 알려진 한계

- `net`/`tls`/`dns`/`zlib`/`readline`/`vm`/`perf_hooks`, WebSocket, `MessageChannel`, BYOB 스트림, `require(ESM)`,
  `file:` URL, REPL이 없습니다. `fs`와 `events`, `assert`, `child_process`에도 빠진 함수가 많습니다.
- 일반 JS·Worker·애드온은 현재 프로세스 권한으로 실행됩니다. CPU/시간 제한은 없습니다.
- 원격 CI 실행, 운영 서명, 24시간 부하 검증은 아직 하지 않았습니다.

남은 작업은 [ROADMAP.md](ROADMAP.md), 모듈 경계는 [ARCHITECTURE.md](ARCHITECTURE.md), 보안 경계는
[SECURITY.md](SECURITY.md)에 있습니다.

## 라이선스

[Mozilla Public License 2.0](LICENSE). `vendor/` 아래 의존성은 각자의 라이선스를 따릅니다.
