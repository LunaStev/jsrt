# 엔진 갱신 검증

호스트 동작은 Wave로 구현하며 JavaScriptCore가 파싱·실행·GC/JIT를 맡는다.
Bun도 JSC를 사용한다는 점은 [공식 런타임 문서](https://bun.com/docs/runtime)에서 확인할 수 있다.
이 선택을 비V8 엔진의 이용률 순위로 설명하지 않는다.

## Linux 검사 환경

`.github/workflows/jsc-matrix.yml`은 GitHub의 workflow_dispatch로 실행하는
Linux 기준 엔진·교체 후보 엔진 검사 구성이다. 이 작업 공간에서 GitHub 실행을 시작하거나
러너를 등록한 것은 아니며, 실제로 두 엔진이 통과했다는 의미도 아니다.

러너에는 self-hosted, linux, x64, jsrt-wave-jsc 레이블과 다음 준비가 필요하다.

- Wave 컴파일러와 std, C 컴파일러, CMake, tar, OpenSSL 명령.
- 프로젝트가 요구하는 libcurl·OpenSSL·libarchive 및 각 JSC의 동적 의존성.
- 로컬 TCP 소켓과 TLS 검사 허용. npm 추가 검사는 공개 레지스트리 HTTPS 접근도 필요하다.
- GitHub 저장소 변수 JSRT_BASELINE_JSC_LIBRARY와 JSRT_CANDIDATE_JSC_LIBRARY에 각각
  해당 러너에서 접근 가능한 JSC 공유 라이브러리 절대 경로를 지정한다.
- checkout action을 지원하는 최신 GitHub Actions 러너를 사용한다.

선택한 라이브러리 경로가 없으면 검사를 실패시키며 다른 엔진으로 조용히 전환하지 않는다.
두 작업은 각각 build/test --require-tcp --probe-worker-termination과 실제 --info를 실행한다.
JSRT_WAVEC 저장소 변수를 전달하며 기본은 PATH의 wavec다.
외부 npm 검사는 run_npm을 선택한 경우 별도로 실행한다.
이 단계는 ./bootstrap.sh test-npm --require-tcp를 호출하며 검사 실행기를 영구 보관하지 않는다.
워크플로의 작업 시간 제한은 CI 프로세스 관리이며 JS CPU 제한이 아니다.

checkout은 [v7.0.1의 고정 커밋](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1)을 사용한다.
시스템 엔진 업데이트는 이 검사 구성 자체가 설치하지 않는다.
공유 라이브러리의 파일 검증·필수 공개 C API 및 SPI 존재·실제 전체 검사를 통과한 후보만 채택한다.

## ESM 연결 확인 결과

현재 JSC 2.54.1 바이너리에서 JSScriptCreateFromString/JSScriptEvaluate와
C++ loadAndEvaluateModule 심볼은 확인했다. JSScript API는 script 평가이며
ESM을 직접 평가하는 C 모듈 로더 API로 취급하지 않는다.
해당 API의 용도는 [WebKit 헤더](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/API/JSScriptRefPrivate.h)에 따른다.

현재 검증 엔진에는 native/cpp/jsc_module_api.cpp를 JSC 내부에서 빌드한 C 연결 계층이 있다.
Wave의 runtime/esm.wave·esm_interop.wave가 resolve·소스 로딩·평가 Promise와
CJS/JSON/builtin synthetic 모듈을 연결한다. Module/Synthetic ABI는 v1,
Worker ABI는 v2이며 빌드와 실행에서 필요한 ABI·심볼을 확인한다.
일치하지 않는 설치 엔진의 private 객체 레이아웃을 추정해 호출하지 않는다.

실제 JSC 2.54.1 전체 회귀·ESM 패키지 사례의 범위는 IMPLEMENTATION.md와
docs/compatibility.md를 따른다. require(ESM)과 CJS named export 추론 등은 여전히 미지원이다.
새 JSC 후보를 채택하려면 이 연결 계층과 패치를 해당 소스 버전에서 다시 빌드·검증해야 한다.

## 생성자 ABI 확인

Web과 Worker는 범용 jsrt_create_callable_constructor 어댑터를 사용한다.
현재 고정 엔진의 JSRTMakeConstructor는 기존 Worker ABI v2에서 도입된 계약이다.
따라서 새 독립 엔진 ABI 버전을 임의로 주장하지 않고, JSRTWorkerABIVersion()==2와
factory 심볼을 검사한 뒤 호출한다. --info의 callableConstructorABI와
constructorFactoryContract가 실제 감지 결과·계약을 표시한다.

심볼·버전·context/callback 인자가 없거나 버전이 다르면 factory를 호출하지 않는다.
비호출 wr_constructor로 조용히 대체하지 않으며 Wave가 초기화 오류를 전달한다.
JSC 2.54.1 버전 번호만으로 이 확장 ABI의 존재를 보장하지 않는다.

tests/context_threads.c의 직렬 native probe는 누락/불일치/NULL 거부·인자 전달·
factory의 NULL 반환을 검사한다. 실제 JSC의 생성자 함수 타입·new 호출·instance 의미는
기존 Web/Worker JS 회귀와 컨텍스트 수명/스레드 검사로 따로 확인한다.
native probe를 실제 다른 엔진 버전의 실행으로 계산하지 않는다.

## 플랫폼 경계

현재 빌드와 이 검사 구성은 Linux 대상이다. Windows/macOS 러너를 적는 것만으로
링커·파일 시스템 ABI·동적 의존성이 이식되지는 않는다. 해당 플랫폼의 구현과 실제 검사는 남아 있다.
