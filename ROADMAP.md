# 남은 작업

현재 구현·검증의 기준은 IMPLEMENTATION.md와 docs/compatibility.md다.
GitHub 공개 전 재점검과 우선 수정 목록은 [2026-10-28 점검](docs/prepublish-review-2026-10-28.md)을 따른다.
2026-10-27 점검에서 재현한 기존 Web/스트림 오류와 JSON reviver 원문 전달은 수정했고,
UTF-8 codec·EventTarget·기본 Web Streams·Readable adapter를 추가했다.
완료한 수정은 이 문서의 미구현 목록에 중복 보관하지 않는다.

## 개발 완료 기준

목표 앱과 API별 지원 계약을 기준으로 완성도를 판단한다. 현재 세부 사용 우선순위는 사용자에게
범용 Node 앱·API 서버·CLI 도구 중 선택을 요청한 상태다. 전체 Node/Bun 호환률 같은 숫자를
구현 개수나 진단 그룹 수에서 추정하지 않는다.

- 각 기능은 정상 실행, 잘못된 입력, 첫 예외 보존, getter 재진입, 취소·종료, 자원 한도와
  반환, intrinsic 변경을 검사하고 지원하는 메서드·옵션·플랫폼을 문서와 일치시킨다.
- 파일·프로세스·네트워크는 실제 OS 작업과 실제 목표 앱을 검사한다. parser/dispatch 검사만으로
  실제 I/O 완료를 표시하지 않는다. Web/Node 의미는 해당 공식 규격의 선택 사례와 대조한다.
- 완료한 오류는 엄격한 영구 회귀로 고정한다. 차이를 출력하는 진단의 exit 0은 수정 완료가 아니다.
- build와 독립 test의 전체 회귀가 통과해야 후보를 게시한다. 생략·실패·엔진/도구 버전·산출물
  해시와 이전 배포물의 검증 범위를 별도로 기록한다.
- 깨끗한 소스 빌드, 정확한 배포물 선택, 독립 VM 설치·복구·삭제, 운영 서명/신뢰 공개키 검증을
  공개 배포의 완료 조건으로 둔다. 설정 파일만 있는 원격 검사는 미실행 상태로 남긴다.
- 장시간 안정성은 별도 실행으로 판정한다. 끝낸 부하를 자동 재시작하거나 60초·54분 실행을
  1시간/24시간 완료로 바꾸지 않는다. 실제 완료 전에는 프로젝트 전체 완료를 표시하지 않는다.

## 외부 검증·배포

- 2026-10-28에 새 API/CLI npm 앱과 Request·Blob·FormData·Web Stream의 HTTP 업로드,
  HTTP 응답의 Readable.toWeb 변환을 실제 TCP로 확인했다. 공개 npm HTTPS 검사도 통과했다.
  독립 TLS 상대에서 HTTPS 업로드·느린 읽기·활성 응답 취소·downgrade 거부·과대 헤더 실패의
  자원 회수도 통과했다. 2026-11-02에 진행 중인 업로드의 중간 취소(느린/빠른 스트림, 24회 반복으로 슬롯
  회수, 완료·취소 동시 실행, Blob)를 상대 쪽 전송 중단 카운터로 확인했다. 그 밖의 전이 조합(redirect 중 취소,
  취소와 서버 응답의 경합 등)은 남아 있다.
- 저장소 URL·self-hosted runner를 연결한 뒤 준비된 CI를 실제 원격 VM에서 실행한다.
  CI 파일 구현·로컬 설정 검사·실제 원격 실행은 구분한다.
- 2026-10-28 새 로컬 release는 일반/이동 배포용 후보 각각의 필수 TCP/npm·설치·복구·삭제와
  필수 60초 부하 검사를 통과했다. 공개 배포와 제공된 운영 키의 서명·신뢰 공개키 검증은 남아 있다.
- 의존성은 upstream 버전과 배포판 보안 backport를 함께 기록한다.
  JSC 2.54.2는 별도 ABI 이식·전체 검증 후보이며 현재 기준선 2.54.1을 조용히 바꾸지 않는다.
- 다른 커널·아키텍처, 실제 정전·파일 시스템 고장 검증은 별도 범위다.
  이전 약 54분 10초 부하는 사용자 종료이며 1시간·24시간 완료가 아니다.
  끝낸 검사나 soak를 요청 범위 없이 재시작하지 않는다.

## API 확대

| 영역 | 아직 남은 범위 |
| --- | --- |
| Node 스트림 | Readable.from·Node async iterator·iterable pipeline, Writable Web adapter와 추가 옵션/호환 의미 |
| Web Streams | byte/BYOB·transfer, 추가 queuing strategy·codec stream 클래스와 WPT 적합성 |
| Web 본문 | 네트워크 Response clone, Request 스트리밍 생성자, File·multipart 파싱·추가 Body 메서드와 Fetch 옵션 |
| 텍스트·이벤트 | UTF-8 이외 decoder, legacy Event 필드·전체 DOM dispatch 적합성 |
| process | TTY·raw mode, stdio 배열, IPC, 자식 env/cwd·추가 spawn 옵션, chdir·kill, 힙 통계 |
| 파일 | FileHandle 추가 overload·vectored I/O·스트림, 콜백 형태의 open/close/read/write/appendFile 등, watch·권한 변경 등 |
| 네트워크 | 독립 net/tls/dns, 서버 TLS, upgrade/WebSocket·압축·프록시, 추가 Fetch/HTTP 옵션과 실패 전이 |
| 패키지 | 일반 glob·nested/개발 링크 workspaces, 그래프 backtracking·전역 hoisting·추가 optional/peer 풀이, 인증·bin/scripts |
| 모듈·유틸리티 | require(ESM)·CJS named export 추론, file/기타 URL(fileURLToPath 포함), querystring.stringify, timers/promises, util.deprecate·promisify.custom, assert.deepStrictEqual, 추가 crypto 등 |
| Worker·애드온 | MessageChannel·transfer·추가 clone 형식, 확장 Node-API·실제 SDK 패키지 사례 |
| 개발 도구 | REPL·watch·source map·디버거·프로파일링·타입 선언 |

추가 API는 실제 목표 앱의 실패 사례에서 선택한다. 수정 전 진단과 최신 재실행 결과는
[점검 기록](docs/implementation-audit-2026-10-27.md)에 연결했다.
Wave 호스트·JSC 실행·wjson JSON·기존 소유권 정책을 유지하며 CPU 실행 제한은 추가하지 않는다.
전체 Node/Bun/npm/WHATWG 호환이나 샌드박스를 제공한다고 표시하지 않는다.
