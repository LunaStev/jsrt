# 다음 대화 시작점

## 전체 검토·검증과 최신 release — 2026-11-02 (Asia/Seoul)

사용자가 전체 검토와 검증을 요청했다. 정적 검사·1058/0/0 회귀(build·독립 test·npm)·Valgrind·Node 대조가
모두 통과했고 새 release(커밋 396a3d1)도 exit 0이다. 상세 표는 IMPLEMENTATION.md 마지막 두 절.

- 최신 runtime SHA-256 **e18a7c37…e6a23**, 최신 archive SHA-256 **2687b574…c63b**
  (파일명 해시 8f4ae8ea…9233). 60초 부하 PASS, 최대 지연 4922 ms(단독 부하는 3.1~3.8초, SLO 아님).
- worker-leaks: 확정/간접 0. still reachable이 한 번 1,808바이트로 나왔으나 4회 재측정은 모두 1,152바이트.
- target/ 정리(엔진 후보 9개·옛 archive)는 권한 분류기가 막아 **아직 하지 않았다**. 사용자가 `!` 명령으로
  직접 실행하거나 Bash 삭제 규칙을 허용하면 진행한다. 보존 대상은 candidate-92596ae0…와 최신 archive 8f4ae8ea….
- 미실행: 원격 CI/VM, 운영 서명, 공개 업로드, actionlint, 깨끗한 환경의 엔진 전체 재컴파일, 1시간/24시간 부하.
- 여전히 열린 질문: 우선 범위(사용자는 "Wave JS 런타임"이라고 답함)와 저장소·runner·서명 키 정보.

## 후속: 지연 조사·구조 정리 — 2026-11-02 (Asia/Seoul)

승인된 계획의 1~4번을 실행했다. 우선 범위 질문에 사용자는
"Wave JS 런타임인 건 아냐?"라고 답했다. Node 앱 종류로 범위를 정하지 말고 Wave 쪽 품질을 먼저 한다.

- 지연 5514 ms는 회귀가 아니다(이전/현재 각 3회: 3296~3783 / 3089~3501 ms). IMPLEMENTATION.md 참조.
- inspect.wave를 5개 모듈로 분할, 문자 코드 상수화, Proxy는 트랩 없이 `Proxy(<target unavailable>)`.
- 하네스 `expect_within` 추가(TLS 통합만 60초). 기본 10초는 그대로다.
- 전체 회귀 **1058/0/0**. 새 release는 만들지 않았다. 최신 archive 24dd2de3…는 이번 소스 변경 전의 것이다.
- 남은 계획: 5번(target 정리)은 사용자 허락 후에만. 엔진 후보 10개·archive 7개가 1.8 GB를 차지한다.
  Proxy 대상 출력은 엔진 패치(JSRTProxyTarget)와 엔진 재빌드가 필요하다.
- process.chdir·querystring.stringify·timers/promises는 실제 필요가 생길 때 추가한다.

## 최신 코어 API 확장·git 초기화·새 release — 2026-11-02 (Asia/Seoul)

사용자가 전체 검토를 요청했고, 이어서 검토에서 나온 1~5번(git, 기본 API, 빌드 안내/CI, HTTPS 업로드 취소,
새 release)을 모두 진행하라고 했다. 아래가 결과다. 우선 범위(범용 Node 앱/API 서버/CLI) 질문과
저장소·runner·운영 키 정보는 여전히 미답변이다.

- git을 초기화했다(`.git`이 빈 폴더였음). 개인 설정(.vscode 등)·키·target은 .gitignore로 제외한다.
  커밋은 bb4a1f1(기준선) 이후 4개이며 최신은 50051b1이다.
- 추가한 API: util.inspect/format과 console 공유 포매터(runtime/inspect.wave, format.wave), Timeout 객체
  (ref/unref/hasRef/refresh/close)와 unref된 타이머는 루프를 유지하지 않는 규칙, setImmediate,
  process.exit/hrtime/uptime/memoryUsage/pid/ppid, global, performance.now, atob/btoa(process_extras.wave),
  util.callbackify와 콜백 fs 10종(callbacks.wave). 계약과 차이는 docs/compatibility.md.
- 알려진 제한: Proxy 트랩이 inspect에서 관찰될 수 있음, Promise 상태·WeakMap 내용 미표시, %o의 showHidden 없음,
  memoryUsage의 힙 항목은 0, process.exit 코드는 0..255만 허용, Worker 안의 exit는 거부.
- HTTPS 업로드 중간 취소 검사를 추가했다(tests/tls_request.js, 검사 상대에 /hold-upload·/hold-upload-slow·/stats).
- docs/building.md를 추가하고 README가 가리키게 했다. release.yml은 이번 실행의 archive 하나만
  서명·업로드·검사한다(YAML 구문만 확인, actionlint 미실행).
- 결과: build·독립 test·release 내부 test 각각 **1058/0/0**, 공개 npm **38/0**, release exit 0.
  runtime SHA-256 **5891c05f…aac3**, archive SHA-256 **24dd2de3…99a2c**(파일명 해시 307e4726…).
  60초 부하 PASS, 최대 지연 5514 ms(직전 2668 ms, 원인 미조사). 1시간/24시간 통과가 아니다.
- 첫 release 시도는 새 TLS 시나리오가 하네스 10초 제한을 넘겨 실패했고, 상대의 읽기 속도를 올려 고쳤다.
  하네스의 expect()는 명령당 10초만 기다린다는 점을 기억한다.
- 미실행: 원격 CI/VM, 운영 서명·신뢰 공개키 검증, 공개 업로드, 깨끗한 환경의 엔진 전체 재컴파일,
  actionlint. target/에 엔진 후보 10개·archive 7개(1.8 GB)가 남아 있으며 정리는 사용자 허락 후에만 한다.
- 남은 API 후보: timers/promises, querystring.stringify, util.deprecate·promisify.custom,
  assert.deepStrictEqual, process.chdir, url.fileURLToPath(file: URL 표현이 먼저 필요).
- 다음 대화는 우선 범위 답을 받은 뒤 그 종류의 실제 npm 앱으로 빠진 API를 찾는 것을 권한다.

## 사용자 종료·다음 대화 재개 지점 — 2026-10-28 (Asia/Seoul)

사용자가 여기까지의 작업을 저장하고 다음에 이어가라고 요청했다. 이번 작업 배치는 종료한다.
새 검증·부하·release·GitHub 게시를 자동으로 시작하지 않는다.

- 사용자는 프로젝트를 충분히 완성하고 싶다고 했다. ROADMAP.md의 **개발 완료 기준**을 유지하고
  기능 존재만으로 완료 처리하지 않는다. 정상/실패·취소·재진입·자원 반환·실제 앱을 함께 검증한다.
- 최신 작업과 검증의 상세는 바로 아래 **완성 기준 설정·헤더/CI/HTTPS 보완** 항목과
  IMPLEMENTATION.md에 있다. 중복 응답 헤더·쿠키 보존/getSetCookie, CI 설정, HTTPS 검사 보완을 완료했다.
- 최종 build·독립 test 각각 **1055개·실패 0·네트워크 생략 0**, Worker 종료 각각 exit 0.
  test-npm도 전체 **1055/0/0**, 공개 npm **38/0**이다. actionlint v1.7.12 exit 0.
- 최신 실행 파일은 target/native/jsrt, SHA-256
  **24dc102de3f7941291436b41ab5efc70e67a846b20f78d916cecb6368d88c531**.
  임시 runner·Go 캐시·TLS 상대/실행 파일/인증서/로그는 정리됐고 target/tools는 없다.
- 기존 배포 archive **b6560fea…44eff8**는 최신 헤더 수정 전의 산출물이다.
  이번에는 새 release/soak·운영 서명·원격 CI/VM·GitHub 게시를 하지 않았다.
- 다음 우선 후보: 진행 중인 HTTPS 업로드 자체의 중간 취소·추가 동시성 검사,
  깨끗한 소스 빌드 안내/재현성, 정확한 배포물 선택·운영 서명·독립 VM 검증,
  그리고 실제 목표 앱에 필요한 API 확대. 상세 잔여 범위는 ROADMAP.md를 따른다.
- 범용 Node 앱/API 서버/CLI 중 최종 우선 범위 질문에는 아직 답이 없다.
  사용자 답을 받으면 그 목표 앱과 호환 시험 범위를 구체화한다. 저장소/runner/운영 키 정보도 미제공이다.
- 새 대화는 이 파일의 시작과 ROADMAP.md·IMPLEMENTATION.md를 읽고, 사용자의 새 요청 범위에서
  이어간다. 이전 사용자 종료 54분 10초와 완료한 60초 release 부하를 1시간/24시간 통과로 표시하지 않는다.

## 최신 완성 기준 설정·헤더/CI/HTTPS 보완 — 2026-10-28 (Asia/Seoul)

사용자가 "난 완벽하게 개발하고 싶은데?"라고 했다. 기능·실패 경로·자원 반환·실제 앱·
빌드/배포 재현성을 함께 완료 조건으로 삼아 ROADMAP.md에 **개발 완료 기준**을 추가했다.
범용 Node 앱/API 서버/CLI 중 최종 우선 범위를 비동기 질문으로 요청했으며 아직 답은 없다.
프로젝트 전체 완료나 전체 Node/Bun/WHATWG 호환을 선언하지 않는다.

- runtime/http_client.wave의 중복 응답 헤더 덮어쓰기를 고쳤다. Node 응답은 Set-Cookie 배열,
  Cookie 세미콜론 결합·일반 헤더 쉼표 결합·singleton 첫 값 보존을 적용한다. Fetch는 별도 정책이다.
- runtime/headers.wave에 private 쿠키 행 목록과 getSetCookie를 추가했다. 복사·Request/Response·
  clone·set/append/delete·sorted live iterator·forEach에서도 Expires 쉼표와 행을 보존한다.
  배열/pair는 독립 사본이다. 16 KiB·64개 예산에 반복 쿠키의 이름/행도 포함한다.
  변환·한도 실패에서 기존 값을 보존하는 영구 Web/HTTP 회귀를 추가했다.
- 원격 헤더 변환/한도 실패는 fetch reject 또는 Node request error로 처리하고 슬롯을 반환한다.
  일반 이벤트 루프 오류로 전파하지 않는다. 실제 TLS에서 fetch 20회 실패+Node error 뒤 새 요청이 통과했다.
- 기존 네트워크 진단은 헤더 수정 뒤 **7그룹·차이 0·대조군 실패 0**이다.
  strict 회귀를 tests/io_network.js와 tests/npm_compat.js의 실제 API 앱에도 연결했다.
- JSC matrix를 jsrt-wave-jsc 라벨·JSRT_WAVEC·명시 Worker 종료 probe로 통일했다.
  세 workflow의 **actionlint v1.7.12 exit 0**을 확인했다. 새 원격 실행은 하지 않았다.
- tests/https_peer.go를 독립 TLS 검사 상대로 추가했다. Go는 허용된 **isolated test helper**이며
  runtime에 링크되지 않는다. Wave compiler 도구가 private Go 캐시를 컴파일 직후 정리하고,
  Wave suite가 검사 상대의 실행·종료·회수와 인증서·로그·실행 파일 정리를 소유한다.
  실제 TLS suite에는 Go compiler가 추가로 필요하며 JSRT_GO로 경로를 지정한다.
- tests/tls_request.js에서 실제 HTTPS 바이트/Blob/Request 원본·clone/FormData 중복·한글·파일/
  Web Stream 업로드·느린 읽기·활성 응답 취소와 원인·downgrade 거부·인증서/hostname 거부를 통과했다.
  진행 중인 **업로드 자체의 중간 취소**와 추가 동시성 조합은 아직 후속 검사다.
- TLS 기능 첫 실행은 통과했지만 캐시 정리 누락으로 **1055개 중 정리 검사 1개 실패**였다.
  컴파일 캐시 수명과 상대 실행 파일 회수를 고친 뒤 최종 **build·독립 test 각각 1055/0/0**,
  Worker 종료 진단 각각 **exit 0**. test-npm도 전체 **1055/0/0**, 공개 npm **38/0**이다.
  독립 test 수명 16회 FD 기준 5, RSS KiB **53996/54984/54984**.
- 최종 runtime SHA-256:
  **24dc102de3f7941291436b41ab5efc70e67a846b20f78d916cecb6368d88c531**.
  기존 API 진단은 **91그룹·확인 39·차이 52·대조군 실패 0**이다. 호환 점수/버그 수가 아니다.
- CommonJS 경로의 "ES modules are not implemented" 두 문구를 실제 require/import 지원 제한으로 고쳤다.
  README·IMPLEMENTATION·ROADMAP·호환/CI/엔진/테스트 문서를 갱신했다. 이전 공개 전 점검 문서는
  수정 전 스냅샷임을 표시했다. JSC 2.54.1·Wave 호스트·wjson·기존 native ABI는 유지한다.
- 이번에는 새 release/soak·운영 서명·원격 CI/VM·GitHub 게시를 하지 않았다.
  기존 archive **b6560fea…44eff8**는 이 헤더 수정 전의 배포물이며 최신 runtime을 포함하지 않는다.
  이후 구현은 ROADMAP의 완료 기준과 남은 API/공개 준비 항목을 따른다.

## 최신 공개 전 다각도 재점검 — 2026-10-28 (Asia/Seoul)

사용자가 GitHub 배포 전 작업을 다시 확인하고 프로젝트 전체를 여러 번 점검하라고 요청했다.
결과와 우선순위는 **docs/prepublish-review-2026-10-28.md**를 먼저 읽는다.
이번 요청은 점검으로 처리했고 runtime·CI 코드는 수정하지 않았다. GitHub 게시도 하지 않았다.

- 구조/정적 검사: Wave 153모듈·import 816개 누락/순환 0, 세 진입점 Wave check exit 0,
  프로젝트 C/C++ 전체 clang-format 통과, 영구 JS/MJS/CJS 18개 JSC --check 통과.
  Node-API 동적 export 48개가 부분 헤더와 일치했다.
- 새 전체 test --require-tcp --probe-worker-termination: **1054개·실패 0·생략 0**, Worker exit 0.
  워밍업 뒤 16회 FD 기준 5, RSS KiB 시작/최고/끝 **54352/55392/55392**.
  기존 API 진단도 다시 **91그룹·확인 38·차이 53·대조군 실패 0**이다.
- tests/prepublish_network_audit.js를 영구 진단으로 추가해 실제 TCP에서 **두 번** 실행했다.
  각각 **7그룹·차이 3·대조군 실패 0**: Set-Cookie 2개 중 마지막만 남고 일반 중복 헤더도
  http.get/fetch에서 마지막만 남는다. 근본 경로는 http_client.wave:605의 같은 키 덮어쓰기다.
  기존 ROADMAP의 소스 수준 우려를 실제 재현했다. 단일 헤더·본문·POST 303/307 대조군은 통과했다.
  이 진단의 exit 0은 gap 해소가 아니다. 수정 후 엄격한 회귀를 main/npm 앱 검사에 연결해야 한다.
- actionlint **v1.7.12 exit 1**: jsc-matrix.yml:17의 jsrt 라벨이 lint 설정에 없다.
  release/stability는 jsrt-wave-jsc다. matrix의 JSRT_WAVEC/명시 Worker probe 정책 차이와
  문서의 checkout 버전 설명도 정리 대상이다. upstream checkout v7 SHA와 ubuntu-26.04 라벨은 유효하다.
- ./bootstrap.sh worker-leaks 256: Valgrind exit 0, 확정/간접 누수 0·오류 0.
  possible 456·reachable 1152·기존 정확한 엔진 초기화 suppression 1바이트를 구분해 기록했다.
  일반 JIT 전체 안전성/전체 누수 부재로 확대하지 않는다.
- 엔진 source archive SHA 일치. 임시 복사본에서 패치 3개를 역순 제거한 6개 파일은 upstream과
  바이트 단위 일치했다. 원래 source/cache를 수정하거나 엔진을 재빌드하지 않았다.
- 현재 archive를 새 /tmp에 풀어 동봉 jsrt-deploy check exit 0: 설치/재설치/실행/삭제.
  현재 커널에서의 검사이며 새 VM 결과가 아니다. 개발 runtime·archive 해시는 직전 기록과 같다.
- dist에 archive가 6개여서 기본 linux-check --image 26.04는 선택 단계 exit 2였다.
  guest 검사를 시작하지 않았다. 정확한 --archive 선택과 CI의 이번 archive만 전달하는 방식이 필요하다.
- 남은 우선순위: 중복 응답 헤더 수정 → CI 라벨/lint/설정 정리 → HTTPS 업로드 검사 →
  깨끗한 소스 빌드 안내·공개 파일 선택 → 정확한 archive/운영 서명/원격 CI·VM.
  ESM 오류 문구 두 곳·호환 문서의 낡은 TCP 미검증 문장도 확인했으나 이번에는 수정하지 않았다.
- 임시 도구/cache·로그·runner·추출/패치 복사본은 정리했다. 새 release·npm 전체 재실행·
  장시간/60초 soak·운영 서명·원격 CI는 실행하지 않았다. 진단 입력·점검 문서만 영구 보관한다.

## 최신 실제 TCP·npm·로컬 release 검증 — 2026-10-28 (Asia/Seoul)

사용자가 현재 상태·다음 작업 점검 뒤 "ㄱㄱㄱ"로 진행을 요청했다.
이전 종료한 soak를 재시작하지 않고 HTTP 실소켓 재검증→npm 앱→새 로컬 release 순서로 진행했다.

- 첫 sandbox 내부 test --require-tcp는 **1039개·실패 2·생략 0**, socket errno -1이었다.
  Worker 진단 exit 0, 기존 runtime 보존. 이후 명시적 샌드박스 밖 실행으로 실제 TCP를 검사했다.
- 샌드박스 밖 전체 test는 **1054개·실패 0·네트워크 생략 0**, Worker 진단 exit 0이다.
  이전 HTTP 9건 실패가 이번 실행에서는 재현되지 않았다. HEAD·204·keep-alive·스트리밍·TLS를 통과했다.
- test-npm의 전체 회귀도 1054/0/0이고 공개 npm HTTPS는 **38개·실패 0**이다.
  고정 그래프의 기존 13종과 새 Polka/cookie/fs API 앱·minimist/lodash CLI 앱 실행을 확인했다.
- tests/io_network.js에 Request 원본/clone 독립 전송, Blob DataView 바이너리,
  FormData 중복 필드·한글·파일 바이트·boundary 일치의 실제 HTTP 업로드 회귀를 추가했다.
  기존 Web Stream 업로드·응답 adapter와 함께 build·독립 test 각각 **1054/0/0**,
  Worker 진단 각각 exit 0이다. 독립 test 수명 16회 FD 기준 5, RSS KiB **53340/53900/53900**.
- release 실제 exit 0. 일반/상대 RUNPATH 배포용 후보 각각 전체 **1054/0/0**, npm **38/0**,
  Worker 종료·이동·clean environment·설치/재설치·업데이트/롤백·여섯 SIGKILL 경계 복구·
  I/O/EFBIG·변조/링크/비관리 파일 거부·삭제 검사를 통과했다.
- release에 필수인 **60초** 혼합 부하만 실행했다: 61표본·559 batches·2237 lanes·
  73302016바이트·3584 Worker·896 abort, PASS. RSS warm/peak/end KiB **55884/57840/52784**,
  관측 최대 지연 **2668 ms**. 1시간/24시간 통과나 지연 SLO 충족으로 해석하지 않는다.
- runtime SHA-256은 기존과 같은 **d52caffff1acff52de1740a70c4fd57dc1505fff613367a282075cdd78314e21**.
  새 로컬 archive:
  `target/dist/jsrt-linux-x86_64-1b534d9ecd3a6755a84a1d240751e62b30a538c4bac99acf8258e31eb9a7f82e.tar.gz`
  SHA-256 **b6560fea0f9ac94569660c715f55e9b4652bcbb625e731518fa82ff90b44eff8**, sidecar와 일치.
  이전 63014a8d… archive의 **285fc3ce…a250d**도 보존·재확인했다.
- README·IMPLEMENTATION·ROADMAP·호환/배포 문서를 갱신했다. 자동 생성 runner·객체·staging·
  부하 입력은 정리됐다. target/tools/tests는 새 archive에 없다. 새 데모/예제는 만들지 않았다.
- JSC 2.54.1, wjson, Wave 호스트와 기존 ABI를 유지했고 runtime 정책 소스는 바꾸지 않았다.
- **HTTPS 업로드 본문 추가 통합 검증은 남아 있다.** TLS 신뢰·호스트명 거부/다운로드와
  HTTP 본문 전송 통과를 합쳐 HTTPS 업로드 통과로 표시하지 않는다.
- GitHub 도구의 저장소 목록을 다시 조회했으나 비어 있다. 로컬 .git/원격도 없다.
  저장소 URL·self-hosted runner·운영 키/신뢰 공개키 경로를 비동기 질문으로 요청했으며 답은 없다.
  새 원격 CI/VM·공개 업로드·운영 서명은 미실행이다. 이후 API 확대는 ROADMAP을 따른다.

## 최신 HTTP 서버 조기 소켓 종료 수정 — 2026-10-27 (Asia/Seoul)

사용자가 일반 터미널의 --require-tcp 전체 로그를 제공했다. 소켓 권한 문제로 생략된 결과가
아니라 **1050개·실패 9·생략 0**인 실제 HTTP 실패였다. HTTPS 통합과 Worker 종료 진단은 통과했다.

- HTTP 서버 요청·응답 스트림이 일반 autoDestroy:true를 물려받아 EOF/finish 때 _destroy로
  공유 소켓을 조기에 닫는 오류를 확인했다. HTTP socket is closed 뒤 HEAD·204·재진입·비동기·
  binary·close·keep-alive가 실패했고, 스트리밍 통합은 partial file 오류였다.
- runtime/http_server.wave에서 서버 IncomingMessage/ServerResponse의 private autoDestroy를
  false로 설정했다. HTTP close/recycle이 정상 종료를 소유하며 명시적 destroy와 오류 처리는 유지한다.
  일반 스트림 기본값은 그대로다. 클라이언트 request_stream은 이미 별도 소유권 설정을 사용한다.
- tests/suites/network_server.wave에 소켓 없는 실제 서버 dispatch 수명 검사 4건을 추가했다.
  전송 훅만 대체해 native I/O 없이 EOF·finish와 명시적 destroy를 검사한다.
  수정 전 **1037개·실패 2·네트워크 2묶음 생략**으로 EOF/finish 회귀 실패를 재현했다.
- 수정 뒤 build와 독립 test 각각 **1037개·실패 0·네트워크 2묶음 생략**,
  Worker 종료 진단 각각 **exit 0**. JSC 2.54.1 및 기존 엔진 경로를 그대로 사용했다.
  tools/build_pipeline.wave는 검증 실패 시 main regression/npm 결과도 표시해 Worker 진단 0과 구분한다.
- 최종 runtime target/native/jsrt의 SHA-256:
  **d52caffff1acff52de1740a70c4fd57dc1505fff613367a282075cdd78314e21**.
  IMPLEMENTATION.md·ARCHITECTURE.md·tests/suites/README.md를 갱신했고 임시 runner는 정리했다.
- **수정 뒤 실제 TCP 전체 통과는 아직 확인하지 못했다.** 사용자에게 같은 --require-tcp 명령으로
  재검증하도록 안내한다. 이 실행 환경의 소켓 제한은 그대로다. 9건 전체 해소를 단정하지 않는다.
  새 release·soak·원격 CI·공개 npm HTTPS 검사는 실행하지 않았다.

## 최신 테스트 분야별 분리 — 2026-10-27 (Asia/Seoul)

사용자가 처음 "1 2 3"을 보낸 뒤 취소했고, 그때는 읽기만 했다.
이후 명시적으로 "1. 전체 분야별 분리 — 권장 ㄱㄱ"를 선택해 아래 작업을 완료했다.

- test.wave는 4,446줄에서 6줄의 진입점으로 줄였다. tests/suites/runner.wave가
  CLI·실행 순서·종료를, harness.wave가 공통 assertion·출력 수집·집계·파일 fixture를 맡는다.
  엔진·컨텍스트·타이머·파일/프로세스·모듈·Web/스트림·클라이언트/서버·패키지·배포를
  13개 분야 모듈로 나눴다. 영구 JS/C 회귀 입력은 그대로다.
- 기존 72개 함수는 공유 상태 접근을 정규화한 뒤 본문·문자열이 동일함을 대조했다.
  run_tests의 inline 기본 JS·타이머 사례를 추출했고 기존 실행 순서·실패/생략 기준을 유지했다.
  병렬 JSC 콜백은 runner 공유 집계나 다른 컨텍스트의 JS 핸들에 접근하지 않는다.
- Wave의 parent import 금지 때문에 테스트 컴파일에만 --dep=jsrt=.를 전달한다.
  tools/compiler.wave의 compile_test_runner가 관리하며, 제품 runtime 컴파일 설정은 그대로다.
  첫 링크 실패에서 기존 runtime hash 보존을 확인하고, 이동한 C extern의 실제 심볼명을 명시해 수정했다.
- 최종 build와 독립 test 각각 **1033개·실패 0·네트워크 2묶음 생략**,
  Worker 종료 진단 각각 **exit 0**. 최종 소스 Wave 타입 검사도 통과했다.
  runtime/tools/tests/suites와 두 진입점: **153개 모듈·816개 내부 import**, 누락/순환 0.
  ldd 미해결 라이브러리 0. JSC 2.54.1과 앞선 검증 엔진 경로를 그대로 사용했다.
- runtime SHA-256은 분리 전후 동일:
  **5a41d8b4386250714d804f6e8209538340d5701678eb93c5806ce3f4ed358c8d**.
  독립 test 호스트 수명 16회: FD 기준 5, RSS KiB **53544/54988/54988**(시작/최고/끝).
  구성 설명은 tests/suites/README.md·docs/structure.md, 현재 결과는 IMPLEMENTATION.md에 반영했다.
- 임시 runner와 점검 파일을 정리했다. 새 release·npm HTTPS·soak·원격 CI는 실행하지 않았다.
  소켓 제한으로 실제 TCP 미검증, 원격 CI·운영 서명/배포 미완료는 아래 기록대로 유지한다.

## 최신 의존성·생성자 ABI 재검증 — 2026-10-27 (Asia/Seoul)

사용자가 의존성과 생성자 ABI를 다시 확인·검증하고 테스트 구성은 먼저 물어본 뒤 진행하라고 했다.

- abort_state.wave에 공통 취소 상태·구독을 모았다. abort→web_events→abort_state와
  abort→abort_state의 Wave 의존 방향이며 기존 jsrt_signal_is_aborted/subscribe/unsubscribe C 우회 함수는 제거했다.
- Wave 모듈 138개·내부 import 752개에서 누락/순환 0. ldd 미해결 라이브러리 0.
- jsrt_worker_constructor를 범용 jsrt_create_callable_constructor로 정리했다.
  엔진의 기존 JSRTMakeConstructor / Worker ABI v2 계약은 그대로다. 심볼/버전/NULL 검사와
  실패한 factory의 NULL 전달을 검증하고 비호출 wr_constructor fallback은 제거했다.
  --info에 callableConstructorABI=true와 실제 factory 계약이 나온다.
- native ABI 회귀 1개를 기존 구성에 추가했다. 실제 JSC Web/Worker 회귀·컨텍스트/스레드/수명도 검사했다.
- 최종 build와 독립 test 각각 **1033개·실패 0·네트워크 2묶음 생략**, Worker 종료 진단 exit 0.
  변경 C/H와 native 테스트 clang-format 검사 통과. 동일 runtime SHA-256:
  **5a41d8b4386250714d804f6e8209538340d5701678eb93c5806ce3f4ed358c8d**.
- 독립 test 호스트 수명 16회: FD 기준 5, RSS KiB **53556/54956/54844**(시작/최고/끝).
  임시 runner 정리 완료. 새 release·soak는 실행하지 않았다.
- **이 검증 시점에는 테스트 파일 구성을 바꾸지 않았다.** 비동기 질문으로 공통 실행기 유지+분야별 분리(권장),
  최근 Web만 분리, 현 구성 유지 3개 선택지를 제시했으며 아직 답이 없다. 답변 전 구조 변경을 진행하지 않는다.
  의존성·ABI 검증용 사례 추가와 테스트 파일 구성 변경을 구분한다.
- 외부 TCP·CI·운영 서명/배포는 아래 이전 기록대로 미완료다. 이번에는 재시도하지 않았다.

## 앞선 Web 구현·검증 — 2026-10-27 (Asia/Seoul)

사용자가 제시된 1~5(기존 오류 수정·기본 Web API·실제 검증/배포)를 모두 진행하라고 요청했다.
로컬 구현과 검증을 진행했고 원격 실행·운영 서명에 필요한 정보는 아직 제공되지 않았다.
현재 기준은 IMPLEMENTATION.md·docs/compatibility.md·ROADMAP.md다.

- 수정 전 P1-1~6을 고쳤다: GET Request 복사, Blob 바이트 뷰·receiver 검사,
  오류 본문 clone, FormData 문자열 한도, 스트림 encoding/allowHalfOpen/autoDestroy/readable·instanceof.
  null body/bodyUsed·dependent signal·Web 속성·일반 iterable/live iterator도 보완했다.
- TextEncoder/Decoder(UTF-8), Event/EventTarget/DOMException, 기본 Web Streams와
  default reader/writer/controller·잠금·역압력·Transform·pipe/tee/비동기 반복을 Wave에 추가했다.
- node:stream/web, Readable.toWeb/fromWeb과 fetch Web 업로드를 연결했다.
  source/sink의 실제 TCP 검사는 현재 소켓 제한으로 미완료다.
- JSON reviver context.source는 wjson 검증 뒤 원래 UTF-16 span과 초기 값을 대응해 처리한다.
  입력은 한 번 변환하고 엔진 JSON fallback·JS bootstrap·대체 Promise 큐는 없다.
- 새 Web 생성자는 현재 검사 엔진의 callable-constructor ABI를 사용한다.
  콜백 정책은 Wave이며 C는 라우팅만 담당한다. 새 엔진·CPU watchdog을 추가하지 않았다.
- 최종 build와 독립 test 각각 **1032개·실패 0·네트워크 2묶음 생략**,
  Worker 종료 진단 **exit 0**. 변경 C/H clang-format 검사 통과.
- 실행 파일은 target/native/jsrt, SHA-256
  **ece62a724901e6e2c92769f726533c67248d612419b30c5d37bf28564f9704a7**.
  build·독립 test·실패한 release 명령 뒤 동일 hash를 확인했다.
- 독립 test 수명 16회: FD 기준 5, RSS KiB **54352/55348/55348**(시작/최고/끝).
  장시간 검사나 전체 누수 부재의 증명은 아니다.
- 영구 tests/audit_matrix.js 재실행: **91그룹·확인 38·차이 53·대조군 실패 0**.
  기존은 확인 6/차이 85였다. 그룹 수를 버그·취약점 수나 전체 호환 점수로 해석하지 않는다.
  선택 의미 검사에는 timer ref/unref·file URL·querystring.stringify가 남아 있다.
- **release를 실제 시도했으나 차단됐다**: TCP socket errno -1로 1034개 중 2개 실패,
  공개 npm HTTPS 5개 중 1개 실패, exit 1. 새 archive/운영 서명은 발행하지 않았다.
  아래 이전 archive의 hash **285fc3ce...a250d**도 그대로 보존했다.
- 연결 도구의 GitHub 저장소 목록이 비어 있고 .git/remote도 없다. CI 설정 3개는 존재하지만
  원격 실행을 하지 못했다. 운영 key path도 설정돼 있지 않다. 저장소 URL·runner·서명 키 경로를
  비동기 질문으로 요청했으며 답은 아직 없다. 승인을 새로 요구한 것이 아닌 실행 정보 요청이다.
- BYOB/byte/transfer·다른 encoding·codec streams·File/multipart 파싱·네트워크 Response clone과
  추가 Node API는 미지원이다. 기본 Web Streams와 전체 WHATWG 적합성을 구분한다.
- 임시 runner는 정리했다. 새 JS 파일은 영구 회귀 소스이며 데모 파일을 만들지 않았다.
  이전 사용자 종료 54분 10초 부하·실제 VM·1시간/24시간 미완료 구분을 유지하고 soak를 재시작하지 않았다.

## 수정 전 점검 — 2026-10-27 (Asia/Seoul)

사용자가 남은 구현을 전반 점검하고 검증하라고 요청했다. 런타임 소스는 바꾸지 않았다.
먼저 docs/implementation-audit-2026-10-27.md와 ROADMAP.md를 읽는다.

- 기존 전체 test를 새 요청 범위로 1회 실행했다: **1027개·실패 0·네트워크 2묶음 생략**,
  Worker 종료 진단 exit 0. 장시간 soak는 재시작하지 않았다.
- 호스트 수명 16회: FD 기준 5, RSS KiB 시작/최고/끝 **53696/54328/54328**.
  런타임 hash는 아래 이전 구현 배치의 **5f8b4a79...d23e7**와 동일하다.
- 영구 tests/audit_matrix.js를 JSC로 실행했다: **91 진단 그룹·확인 6·차이 85·대조군 실패 0**.
  미지원 표면과 의미 차이를 묶은 수이며 버그/취약점 85개나 호환 통과를 뜻하지 않는다.
- 먼저 고칠 재현: GET Request 복사 실패, Blob DataView/비 Uint8 view의 문자열 변환,
  오류 본문 clone의 내용 복원, Web receiver 검사 누락, FormData의 URL 전용 문자열 한도,
  stream encoding/allowHalfOpen 옵션 무시. **아직 수정하지 않았다.**
- 추가 Web 의미·JSON reviver context.source와 없는 전역22/모듈14·부분 메서드를 목록화했다.
  Headers live iterator, URL encoded dot 정규화는 정상이라 미구현으로 기록하지 않는다.
- docs/engine-validation.md의 “ESM 브리지 미완료”와 docs/structure.md의 낡은 상태 영역 수를 수정했다.
- JSC 2.54.2 공개를 확인했지만 기준선은 2.54.1 유지다. curl/OpenSSL/libarchive는 배포판
  보안 backport를 포함한다. curl CVE-2026-92392·4873 패치 기록을 실제 패키지 changelog에서 확인했다.
  전체 CVE 적용성 분석·네트워크 exploit 검사를 완료했다는 뜻은 아니다.
- 새 배포·원격 CI·실제 업로드/TLS/새 npm 앱 검증은 여전히 미완료다. 이번에는 actionlint가 없었다.
  임시 runner는 정리됐고 새 파일은 영구 진단 소스와 점검 문서다.

## 앞선 구현 배치 — 2026-10-26

최종 갱신: 2026-10-26 (Asia/Seoul).
사용자가 오래된 설명·불필요한 항목을 정리하고 우선순위 1~5를 진행하라고 요청했다.
아래 범위로 구현했고 최종 검증·산출물 정보는 IMPLEMENTATION.md를 따른다.
이전 단계별 문서는 현재 설명으로 통합했다.

## 이번 변경

- 자원·실패 경로: primitive/NULL callable 검사, 훅 getter 재진입 destroy 후 진행 중단,
  batch 완료·취소 구독·FD·root 정리. 자식 파이프는 공개 stdin/stdout/stderr 속성이 바뀌어도
  private 보호 참조로 회수하고 실패한 spawn의 이미 생성된 파이프도 정리한다.
- 스트림: 독립 양면 Duplex, Transform/PassThrough 상속, 중첩 cork/uncork·writableCorked·writev,
  생성자 signal과 완료/파괴 시 구독 해제. Wave 정책·기존 역압력을 유지한다.
- CLI: nextTick FIFO·Promise 체크포인트 순서, stdin, child_process 세 방향 pipe,
  nonblocking FD·스레드별 SIGPIPE 처리·exit/close 분리·소유 PID 회수.
  nextTick은 Wave 호스트 콜백 큐이며 Promise 작업 큐는 여전히 JSC 소유다.
- Web: Blob 스냅샷/read/slice, 버퍼 Request/Response·clone·Response.json,
  FormData 필드·Blob·multipart와 fetch Request/Blob/FormData 입력·Content-Type.
- 패키지: 프로젝트 상대 경로/마지막 /* workspaces의 관리 스냅샷, 원본 전체 digest 잠금,
  frozen/offline 재설치·로컬 순환, 누락 peer의 공유 부모 범위 교집합 선택.
- README·SECURITY·INSTALLER·ROADMAP·호환/구조 문서를 현재 범위로 정리하고
  참조 없는 docs/project-review-2026-10-24.md, 미사용 import/ABI 선언, 임시 진단 로그·실패 작업공간을 제거했다.
  영구 회귀 소스와 기존 배포물·필요 엔진은 보존했다.

## 검증과 산출물

최종 build와 독립 test 각각 **1027개·실패 0·네트워크 2묶음 생략**, Worker 종료 진단 **0**이다.
변경 C/H의 clang-format 검사도 통과했다. 두 명령 뒤 동일한 런타임 SHA-256을 확인했다:
`5f8b4a79b062d221651b089cb9bb919d798df3380d44b7874db183ecf76d23e7`.
실제 연결 버전·검사 명령·수명 측정은 IMPLEMENTATION.md에 있다. 임시 빌드/진단 파일은 정리했다.

검사 엔진은 JSC 2.54.1 / Worker ABI v2:
`target/engines/jsc-module-2.54.1/candidate-92596ae086a103c82a53c64b1c3c875a/libJavaScriptCore.so`.
런타임은 target/native/jsrt다. 구버전 허용·다른 엔진·JS bootstrap·CPU watchdog을 사용하지 않았다.

현재 workspace-write/네트워크 제한 환경이다. TCP socket 생성·외부 DNS가 제한되며
네트워크 2묶음은 명시적으로 생략한다. 새 API/CLI 앱의 npm 설치/TCP 실행과
새 Web 본문의 실제 HTTP(S) 업로드는 아직 검증하지 못했다.

새 release/운영 서명은 발행하지 않았다. 기존 배포물은 이번 새 기능을 포함하지 않는다:
`target/dist/jsrt-linux-x86_64-63014a8dfd176c599d29392708b166b191e0dc1ba53bd43f3b9bea66696426da.tar.gz`
SHA-256 `285fc3ce2f5d7edd412252822fa50f67c063b1e1fa8ccc5724f38dc87c5a250d`.
기존 배포물의 npm 36개·실제 TCP와 Ubuntu 26.04/26.10 PRoot 사용자 공간 검증은
새 기능·별도 커널/VM 검증으로 계산하지 않는다.

## 남은 범위

- 네트워크 허용 환경의 새 앱·업로드 검증, 새 배포 묶음·운영 공개키 서명.
- 로컬 .git/원격 URL이 없고 연결된 GitHub 저장소 조회도 비어 있었다.
  저장소 URL·runner 정보가 아직 없다. CI/actionlint 설정 구현과 실제 원격 CI/VM 실행을 구분한다.
- WHATWG Streams·tee·네트워크 Response clone·File, 전체 Request/Response/Headers 적합성은 미완료다.
  현재 Response.body는 호스트 Readable이다. 상세 차이는 docs/compatibility.md를 따른다.
- workspaces는 개발 링크가 아닌 스냅샷이다. 일반 glob·nested/개발 링크·고급 peer/optional 풀이·
  backtracking/전역 hoisting, 나머지 net/tls/dns·확장 Node-API 등은 ROADMAP.md를 따른다.

## 검사 재개 원칙

이전 부하는 사용자 요청으로 약 54분 10초에서 정상 종료했다. 자식은 0,
1시간 목표 미달로 검사 도구는 1이었다. 1시간·24시간 완료나 런타임 오류로 해석하지 않는다.
이전/완료한 부하·전체 검사를 요청 없이 자동 재시작하지 않는다.
이번 전체 검사는 새 구현 요청의 범위였으며 이후 검사는 다음 요청에 맞춰 정한다.

Wave 호스트·JSC 전용 실행·wjson JSON·기존 소유권 정책을 유지한다.
