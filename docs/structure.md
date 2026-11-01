# 프로젝트 구조와 정리 기준

## 진입점

`runtime/main.wave` → `runtime/app.wave` → CLI / 세션 / 호스트 / 이벤트 루프.
main은 호출만 담당하며 기능 구현은 runtime의 각 모듈이 맡는다.

`build.wave` → `tools/build_app.wave` → `tools/build_pipeline.wave` → 컴파일·링크 / 검사 / 게시.
기준 엔진 버전은 runtime/config.wave에서 한 번 정의해 빌드 진입점이 전달한다.

`test.wave` → `tests/suites/runner.wave` → 분야별 검사 모듈과 tests의 영구 회귀 fixture.
공통 실행·결과 집계는 harness.wave에 모으며, 검사 도중 실행하는 JS는 JavaScriptCore가 처리한다.
분야별 책임과 실행 옵션은 [테스트 구성](../tests/suites/README.md)을 참고한다.

## 언어별 책임

| 위치 | 책임 |
| --- | --- |
| runtime/*.wave | Wave 런타임 본체. CLI·세션·모듈·타이머·스트림·파일·네트워크·JSON·상태 관리 |
| tools/*.wave | Wave 빌드·검사 도구와 프로세스·파일 처리 |
| tests/suites/*.wave | 공통 runner·harness와 엔진·Web·파일·네트워크·패키지·배포 분야별 검사 |
| native/c/ | 엔진·libuv·libcurl·llhttp·POSIX 구조체 및 콜백 ABI 연결 |
| native/cpp/node_api.cpp | JavaScriptCore 공개 C API 위의 Node-API 부분 ABI·핸들/콜백 연결 |
| native/include/jsrt_node_api.h | 현재 연결한 ABI 선언의 부분 헤더. 공식 전체 Node SDK 아님 |
| runtime/addons.wave | 애드온 한도·로딩 진입·종료 정책. 경로와 캐시는 modules.wave가 처리 |
| tests/*.js | 실제 JSC로 실행하는 영구 회귀 검사 입력 |
| tests/native_addon.c | 실제 .node ABI 회귀 입력. 생성 바이너리는 임시 빌드 폴더에만 존재 |
| tests/context_threads.c | 병렬 JSC 검사의 pthread 시작·join ABI. 제품 실행 파일에는 연결하지 않음 |
| vendor/ | 버전·출처·라이선스를 보존한 외부 기반 라이브러리 |
| docs/ | 구현 구조·검증 환경 설명 |

Wave로 직접 처리하기 어려운 Node-API ABI에 C++ 연결부를 추가했다.
Rust·Go는 아직 실제 연결할 구성 요소가 없어 폴더나 호출되지 않는 코드를 만들지 않는다.
런타임과 호스트 정책의 주 언어는 Wave이며 C++으로 호스트를 옮기지 않는다.

context_state.wave가 실행 호스트 각 영역의 상태와 할당 크기를 각 JSC global의 private data에 붙인다.
모듈·스트림·HTTP·URL·암호·취소·유틸리티·libuv 루프·자식 프로세스까지 컨텍스트마다 별도다.
엔진 ABI의 스레드 로컬 바인딩은 컨텍스트 없는 I/O 콜백에서 소유 환경을 찾는 용도로만 사용한다.
실제 모듈 상태와 메모리 정책은 Wave에 있으며 종료 순서가 끝난 뒤 상태 슬롯을 해제한다.
파일 작업자는 전달받은 큐의 바이트 작업만 처리하며, JSC 완료 콜백은 소유 스레드가 실행한다.
병렬 검사에서 쓰는 C 파일은 pthread ABI만 제공하고 실제 JSC 생성·API 설치·작업·정리는 Wave가 맡는다.
검사용 객체는 임시 빌드 폴더에 생성하며 테스트 종료 후 삭제한다.

child_process.wave는 POSIX spawn·신호·waitpid를 Wave에서 조정하며 소유 자식을 회수한다.
resources.wave는 명시적인 주소 공간 제한 정책만 맡고 filesystem_abi.c가 rlimit 구조체/상수를 연결한다.
이 두 기능을 worker_threads·JS 힙 전용 제한·프로세스 샌드박스로 표시하지 않는다.

## 생성 파일 수명

- bootstrap 컴파일러 출력과 빌드 도구는 전용 임시 디렉터리에 만들고 EXIT trap으로 지운다.
- 네이티브 빌드 객체·검사 실행기는 target/tools의 전용 작업 폴더 안에만 만든다.
- 각 검사에서 만든 JS 파일·stdout/stderr·패키지·인증서 등은 해당 검사의 정리 경로에서 삭제한다.
- 검사 실행기의 최종 작업 폴더 삭제를 확인하고, 빌드 앱도 자기 작업 폴더 삭제 결과를 확인한다.
- target/tools/tests는 더 이상 게시하지 않는다. npm 검사는 ./bootstrap.sh test-npm으로 재실행한다.
- 검사 실패 시 런타임 게시를 하지 않으며 임시 빌드 파일은 정리한다.
- target/native/jsrt는 제품 실행 파일, target/deps는 빌드 의존성 캐시,
  target/engines는 실제로 링크하는 엔진이므로 테스트 종료 때 지우지 않는다.
- 영구 테스트 소스는 재검증을 위해 보존한다. 실행 중 생성된 자료와 구분한다.
- SIGKILL·전원 차단은 EXIT trap을 실행하지 못하므로 이 경우의 즉시 정리를 보장하지 않는다.

기본 빌드 확인에 사용하던 hello 예제는 제거했고 기존 회귀 fixture를 구문 검사한다.
이전 고정 경로의 빌드/검사 실행기·객체, 오래된 호환 실행 파일과 사용하지 않는 엔진 다운로드
압축본도 삭제했다. 실제 엔진 공유 라이브러리와 배포 라이선스 정보는 유지한다.
