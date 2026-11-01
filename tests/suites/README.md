# 테스트 구성

`test.wave`는 `runner.wave`만 호출한다. `runner.wave`는 기존 실행 순서와
`--termination-only`, `--transaction-fixture`, `--npm-only`, `--require-tcp` 처리를 유지한다.
`harness.wave`가 공통 assertion, 자식 프로세스 출력 수집, 결과 집계와 파일 fixture 도우미를 맡는다.

| 분야 | 모듈 | 검사 대상 |
| --- | --- | --- |
| 엔진·네이티브 | engine.wave | 생성자 ABI, Worker, 정보 출력, JSON 대조, 애드온, 기본 JS |
| 컨텍스트·수명 | contexts.wave | 독립 JSC 컨텍스트·스레드, 호스트 종료·FD·RSS, native 콜백 |
| 타이머 | timers.wave | 타이머, microtask 순서, 콜백 수명과 실패 전달 |
| 파일·프로세스 | files_process.wave | 동기·비동기 파일, 디렉터리, 시스템·자식 프로세스 |
| 모듈·CLI | modules.wave | CommonJS, ESM, interop, test 명령 |
| Web·스트림 | web_streams.wave | Buffer, EventEmitter, Web API·스트림, 파일 스트림, URL, crypto |
| 네트워크 | network_client.wave / network_server.wave | 클라이언트·취소·업로드, HTTP 파서·응답·dispatch·실제 TCP |
| 패키지 | package_versions.wave / package_install.wave | semver·cache, 설치·workspace·의존성 |
| 복구·registry | package_recovery.wave / package_registry.wave | transaction 복구·교체, 선택적 공개 npm HTTPS·호환 입력 |
| 배포 | deployment.wave | 임시 키를 이용한 서명·변조 거부 검사 |

JS 입력과 기대 결과, 검사 순서·실패 기준은 분리 전과 동일하다. 사례가 공유하는 도우미만
다른 모듈에 공개한다. 테스트별 `main`이나 별도의 assertion 프레임워크는 만들지 않는다.
기존 `tests/*.js`, `tests/*.c` 등은 영구 회귀 입력이다.

공통 `TestState`는 runner 프로세스의 소유 스레드에서만 사용한다. `contexts.wave`의
병렬 native 콜백은 공통 집계나 JS 핸들을 공유하지 않고, join 후 소유 스레드에서 결과를 검사한다.
C ABI 선언에는 실제 심볼명을 명시해 Wave 모듈 이동으로 링크 이름이 달라지지 않도록 한다.

Wave는 `../` import를 허용하지 않는다. 테스트 컴파일에만 `--dep=jsrt=.`를 전달해
`jsrt::runtime::*`, `jsrt::tools::*`로 프로젝트 모듈을 참조한다.
이 설정은 `tools/compiler.wave`의 `compile_test_runner`가 관리한다.

검증은 저장소 루트에서 기존 `./bootstrap.sh build`와 `./bootstrap.sh test`를 사용한다.
사용할 엔진이 별도 경로에 있다면 기존처럼 `--engine-library <경로>`를 전달한다.
공개 npm 검사는 `./bootstrap.sh test-npm`으로 별도 실행한다.
TCP 권한이 없는 환경에서는 live suite 생략을 명시하며, `--require-tcp`일 때는 실패한다.
HTTP 수명 회귀는 소켓 없이 파싱된 요청을 실제 서버 dispatch에 전달하고, 전송 훅만 대체해
요청 EOF·응답 finish가 공용 전송을 자동 파괴하지 않는지와 명시적 destroy를 검사한다.
실제 native 쓰기·연결 재사용·TLS 동작은 live suite에서 별도로 확인해야 한다.
HTTPS live suite는 tests/https_peer.go를 독립 검사 상대로 쓴다. tools/compiler.wave가
private 캐시로 컴파일하고 그 캐시는 즉시 정리한다. Wave가 검사 상대의 실행·종료·회수와
인증서·로그·실행 파일 정리를 소유한다. Go는 제품 runtime에 링크되지 않는다.
생성 runner·객체·로그·입력은 기존 private build 디렉터리 정리 절차를 따른다.
