# Node-API 부분 ABI

호스트는 Wave, 실행 엔진은 JavaScriptCore다. C++은 ABI와 JS 핸들/콜백만 연결한다.
Wave의 modules.wave가 .node 경로·패키지 해석·캐시·실패 기록을 처리하고 addons.wave가
한도와 연결 계층의 설치·로딩·종료 진입을 맡는다. JS 파서나 C++ 이벤트 루프는 추가하지 않았다.

## 연결 범위

심볼 기반 `napi_register_module_v1` 등록을 사용한다. 선언된 버전이 있으면 1만 허용하고
없으면 v1 초기화 진입점을 요구한다. `napi_get_version`은 1을 반환하지만 API 전체 v1 적합성을 뜻하지 않는다.
런타임 메타데이터는 `Node-API v1 subset`, `complete:false`, `async:false`로 표시한다.
이는 실제 일부 C ABI를 구현한 것이며 지원하지 않는 API를 성공하는 빈 함수로 대체하지 않는다.

| 영역 | 연결한 기능 |
| --- | --- |
| 기본 값 | undefined/null/global/boolean, typeof, strict equality |
| 숫자 | double/int32/uint32/int64 생성·읽기, NaN/Infinity/32-bit modulo 처리 |
| 문자열 | UTF-8/Latin-1/UTF-16 생성, UTF-8/UTF-16 길이 조회·읽기, NUL·Unicode 보존 |
| 객체·배열 | 생성·길이·배열 판별, named property get/set/has, element get/set |
| 속성 | 값·method·getter/setter descriptor와 writable/enumerable/configurable |
| 함수 | 네이티브 callback 생성, cb_info의 인자·receiver·data, JS 함수 호출 |
| 예외 | Error/TypeError/RangeError 생성·throw, pending 조회·원래 예외 가져오기/해제 |
| 핸들 | 일반 handle scope의 open/close와 호출 프레임별 protect/unprotect |
| 진단 | API version, last error info |

정확한 선언은 [부분 헤더](include/jsrt_node_api.h)를 따른다. 이 헤더는 공식 전체 SDK가 아니다.
ABI 이름·등록/버전·타입은 [Node의 공개 헤더](https://github.com/nodejs/node/tree/v24.16.0/src)와
[공식 API 문서](https://nodejs.org/download/release/v24.16.0/docs/api/n-api.html)를 참고했다.
공식 SDK를 쓰는 애드온은 `NAPI_VERSION=1`과 이 부분 기능만 사용해야 하며, 별도 실제 패키지 호환 검증은 남아 있다.

참조/weak reference·escapable scope·Buffer/외부 메모리·finalizer·wrap/클래스·Promise/deferred·
비동기 작업·thread-safe function·cleanup hook 등은 미구현이다. V8/Node 내부 API를 직접 쓰는 바이너리도 연결하지 않는다.
외부 심볼이 없으면 RTLD_NOW 로딩을 실패시키고 JS에 ERR_DLOPEN_FAILED를 전달한다.
지원하지 않는 선언 버전은 ERR_NAPI_VERSION, 초기화의 JS 예외는 원래 객체로 전달한다.

## 소유권과 한도

환경은 컨텍스트별이며 해당 컨텍스트 소유 스레드에서만 API를 사용할 수 있다.
JS 핸들을 다른 컨텍스트나 스레드와 공유하지 않는다. 동기 콜백과 초기화에는 기본 핸들 프레임이 있다.
함수와 descriptor의 native callback data는 환경 수명 동안 유지되며 일반 스코프 종료와 별도로 관리한다.
일반 스코프는 LIFO로 닫는다. 초기화·콜백 종료 때 남은 프레임 핸들을 해제한다.

한도는 Wave의 config.wave에서 전달한다: 컨텍스트당 라이브러리 64개, 네이티브 함수 1024개,
동시에 보호하는 프레임 핸들 65536개, 입력 문자열 4 MiB(UTF-16은 2 Mi code units)다.
함수는 환경 종료까지 보호하므로 동적으로 생성하는 함수에도 누적 한도가 있다.
실패한 초기화가 함수를 JS에 남길 수 있어 해당 라이브러리도 컨텍스트 종료까지 유지하고 한도에 포함한다.
중첩 scope는 128개까지 지원한다. 전체 JS 힙 제한을 제공하지는 않는다.

호스트 종료는 JS 보호 참조를 해제하고 환경을 닫는다. 엔진 컨텍스트를 해제한 다음 dlclose한다.
현재 제공하지 않는 비동기 native 작업이나 finalizer가 남는 경우까지 안전하다고 주장하지 않는다.
애드온은 프로세스 권한으로 실행하는 신뢰된 네이티브 코드이며 메모리/권한 샌드박스가 아니다.

## 검사

tests/native_addon.c를 빌드 도구의 전용 임시 폴더에서 다섯 종류의 .node로 컴파일한다.
test.wave는 실제 require·캐시·인자/반환·예외·Unicode/NUL·프레임/스코프·버전과 심볼 실패를 검사한다.
초기화 실패 후 유출된 네이티브 함수, 두 컨텍스트의 환경 분리와 다른 환경 종료 후 호출도 포함한다.
스코프에서는 프레임 한도보다 많은 70000개 값을 순차 생성/해제한다.
소유 스레드가 아닌 네이티브 스레드의 API 사용은 거부한다.
생성한 .node·객체·검사 실행기는 성공·실패 후 정리하며 영구 회귀 소스는 보존한다.
