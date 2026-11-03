<p align="center"><img src="wave.svg" width="280" alt="Wave 로고"></p>

# jsrt

Wave로 구현하고 JavaScriptCore를 내장한 JavaScript 런타임.

> 개발 중입니다. Node.js·Bun·npm 전체 호환이 아니며 샌드박스도 아닙니다. `jsrt`는 임시 이름입니다.

- **엔진**: JavaScriptCore 2.54.1 (JS 실행·GC·JIT)
- **호스트**: Wave (모듈, 이벤트 루프, 타이머, 파일·네트워크·Worker, 패키지 설치)
- **JSON**: wjson
- **네트워크**: libuv · llhttp · libcurl

## 빌드와 실행

Wave 컴파일러, C/C++ 컴파일러, `cmake`, `ninja`, libcurl 8.13+ 가 필요합니다. 순서는 [docs/building.md](docs/building.md).

```sh
./bootstrap.sh engine-build
./bootstrap.sh build --engine-library <libJavaScriptCore.so 경로>

jsrt app.js
jsrt -e "console.log(1 + 1)"
```

## 한계

`net`/`tls`/`dns`/`zlib`/`readline`/`vm`, WebSocket, `MessageChannel`, `require(ESM)`, REPL은 없고, `fs`·`events`·`assert`·`child_process`는 일부만 지원합니다.
지원 범위는 [docs/compatibility.md](docs/compatibility.md), 남은 작업은 [ROADMAP.md](ROADMAP.md)를 보세요.
이 저장소에는 테스트 소스가 없습니다.

[Mozilla Public License 2.0](LICENSE)
