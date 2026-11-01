# 동봉 JavaScriptCore 소스와 패치

원본: https://webkitgtk.org/releases/webkitgtk-2.54.1.tar.xz

SHA-256: ea0bbb02dbdbc596874a4e7ad35b66645b3e0a232bd0e4081de5ed92eb0a397d

engine-source의 webkitgtk-2.54.1.patch, module-output.patch, synthetic-modules.patch가
엔진 내부 모듈/Worker/복제 ABI 연결에 사용된 프로젝트 패치다.
원본 Source/JavaScriptCore/COPYING.LIB는 licenses에 포함한다.

프로젝트의 tools/engine_build.wave와 ./bootstrap.sh engine-build가 소스 검증·패치 확인·
같은 소스 안의 C++ 어댑터 빌드를 수행한다. 재빌드는 프로젝트 소스의
native/cpp/jsc_module_api.cpp와 native/include/jsrt_modules.h도 필요하다.
빌드 의존성과 검증은 프로젝트 native/ENGINE_ABI.md와 docs/engine-validation.md를 따른다.
시스템 JavaScriptCore에 이 private ABI가 있다고 가정하지 않는다.

Worker ABI v2는 JSRTDrainOwnerRunLoop를 추가한다. Wave는 Worker 종료 시 mutex 아래에서
부모의 종료 요청용 VM 참조를 회수하고, 소유 스레드에서 마지막 VM 해제와 비차단 RunLoop
정리 cycle을 수행한다. 이는 엔진 타이머 폐기 작업을 위한 ABI이며 JS bootstrap이나 별도 Promise 큐가 아니다.
v1 엔진에는 새 Worker 기능을 켜지 않는다. 엔진 빌드는 기존 후보를 덮어쓰지 않는다.
