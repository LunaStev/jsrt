# 보안·소유권 경계

jsrt는 같은 프로세스에 JavaScriptCore를 내장한다. JS·Worker·네이티브 애드온은 호스트의
파일·네트워크·프로세스 권한을 사용한다. 신뢰할 수 없는 코드를 격리하는 샌드박스는 아니다.

## 엔진과 실행

JSC가 파싱·실행·GC·JIT와 Promise 큐를 소유한다. 기본 기준선은 JavaScriptCoreGTK 2.54.1이며
빌드·실행 때 실제 버전과 필수 심볼을 확인한다. 구버전은 명시적 별도 빌드로만 허용한다.
ESM·Worker·clone은 일치하는 엔진 ABI를 확인한다. 거부 감시는 WebKit SPI에 유효한 콜백을
등록하며 종료 때 모니터링을 끈다. NULL 콜백으로 교체하지 않는다.

각 컨텍스트에는 한 소유 스레드가 있다. JS 핸들을 다른 컨텍스트나 작업 스레드에 넘기지 않는다.
중첩 엔진 호출은 활성 컨텍스트를 바인딩하고 이전 바인딩을 복원한다.
Worker의 마지막 VM 참조와 RunLoop 타이머 폐기는 해당 Worker 스레드에서 끝낸다.

nextTick은 Wave의 별도 호스트 콜백 FIFO다. 일반 JS 진입을 감싸는 네이티브 엔진 진입 안에서
FIFO를 비운 뒤 JSC가 자체 Promise 체크포인트를 처리한다. Promise가 예약한 nextTick은
그 체크포인트 뒤 처리한다. JS bootstrap이나 대체 Promise 큐는 없다.
대기 nextTick 1024개·추가 인자 64개를 적용하며 완료·실패·종료 시 root를 해제한다.

CPU watchdog·JS 실행 시간 제한은 없다. `--memory-limit-mb`는 명시적인 POSIX RLIMIT_AS
soft limit이며 RSS·JS 힙 크기와 다르다. 더 낮은 상속 한도와 hard limit은 완화하지 않는다.
JSC 가상 주소 예약도 포함하므로 작은 한도에서는 초기화가 실패할 수 있다.

## 네이티브 자원과 콜백

자원 슬롯은 옵션 getter를 읽기 전에 예약한다. 첫 변환 오류 뒤에는 native buffer/string 처리를
진행하지 않는다. callable 판정은 native NULL과 JS primitive를 먼저 거부한다.
스트림 훅 getter가 재진입해 destroy하면 새 쓰기·변환·final 호출을 시작하지 않는다.

JS 콜백과 인자는 필요 기간 동안 protect한다. private 상태는 JSC WeakMap 그래프에 두며
사용자 속성으로 노출하지 않는다. 지연 완료는 소유권·상태를 다시 확인하며 이중 완료를 거부한다.
writev 성공·실패는 각 원래 쓰기 콜백을 처리하고, 정리 중 첫 예외를 보존한다.
취소는 사용자 abort 리스너보다 먼저 실행하는 private 알고리즘이며 완료·destroy 때 구독을 떼어낸다.
Abort API·EventTarget은 공통 Wave 취소 상태를 직접 참조하며 상호 의존을 C ABI로 우회하지 않는다.
범용 생성자 factory는 일치하는 엔진 ABI·심볼·인자를 검사하고 미지원 fallback을 사용하지 않는다.
finished의 감시 취소와 stream destroy는 구분하고 pipeline 취소는 모든 멤버를 destroy한다.

파일 작업 스레드는 JSC나 JS 핸들에 접근하지 않는다. 같은 자원 작업은 직렬화하고 close는 앞선
작업 뒤 실행한다. 작업자를 join하기 전에 공유 메모리·descriptor를 해제하지 않는다.
join 실패 시 관련 자원과 컨텍스트를 보존한다. FileHandle은 명시적 close 또는 호스트 종료로 회수한다.

libuv·libcurl 콜백은 JS를 호출하지 않는다. Wave 주 루프가 uv_run 밖에서 사용자 콜백을 호출한다.
close/write 완료를 처리한 뒤 endpoint·버퍼·엔진 컨텍스트를 해제한다.
클라이언트 슬롯 재사용 전에 취소 구독을 해제하며 curl 송신·수신 pause 플래그는 독립적이다.

## 파일·프로세스·애드온

동기·비동기 쓰기는 인자 검증 후 파일을 열거나 truncate한다. 일반 fs와 require는 호스트가 접근할
수 있는 경로를 사용하며 심볼릭 링크를 통한 접근을 막는 권한 경계가 아니다.
FileHandle/스트림 큐 한도는 전체 프로세스 메모리나 객체 내부 크기의 한도가 아니다.

stdin은 Linux `/proc/self/fd/0`을 별도 O_NONBLOCK·close-on-exec 파일 설명으로 연다.
원래 FD의 플래그를 바꾸거나 닫지 않는다. Worker의 stdin 읽기는 거부한다.
stdout/stderr는 상속 FD를 사용하는 동기 Writable이며 FD를 닫지 않는다.

spawn은 절대 실행 파일 경로, 인자 배열, 명시적 inherit/pipe stdio만 받는다.
shell·PATH 검색·env/cwd·uid/gid·detached·IPC·stdio 배열 등 미지원 옵션은 거부한다.
파이프는 close-on-exec으로 만들고 부모 쪽만 nonblocking으로 둔다. child 파일 동작용 FD는
표준 FD와 충돌하지 않게 옮긴다. 읽기는 단일 read의 실제 바이트를 보존한다.
쓰기에서 새로 발생한 SIGPIPE만 현재 스레드에서 회수하고 기존 신호 마스크를 복원한다.
소유 PID만 신호·회수하며 재수거한 PID에 다시 신호를 보내지 않는다.
exit 뒤 출력 파이프를 정리하고 close 전에 자식 슬롯을 반환한다. 호스트 종료는 남은 자식을 회수한다.

Node-API는 v1 부분 ABI다. Wave가 로더·캐시·한도·수명을, C++은 핸들·콜백 ABI를 담당한다.
미구현 심볼·버전은 로딩 오류다. 실패한 초기화에서 탈출한 JS 함수가 있을 수 있어 라이브러리를
즉시 unload하지 않는다. JS root를 풀고 컨텍스트를 폐기한 뒤 라이브러리를 닫는다.
애드온은 신뢰된 native code이며 메모리 손상이나 외부 작업을 차단하지 않는다.

## 네트워크와 Web 본문

libuv·llhttp는 고정 vendored 소스를 빌드하며 파서 leniency를 켜지 않는다.
중복/누락 Host·상충 framing·접힌 헤더·헤더 CR/LF/NUL 삽입과 사용자 framing 헤더를 거부한다.
요청/헤더/URL/연결 수와 전송 바이트에 한도를 적용한다. 기본 listen 주소는 127.0.0.1이다.
keep-alive 재사용은 이전 요청/응답의 소유권과 분리한다.

서버 헤더·요청 기한은 monotonic 절대 기한이며, 유휴 기한은 실제 I/O 때만 연장한다.
기본값은 헤더 60초·요청 300초·유휴 30초다. JS가 반환하지 않으면 기한 처리를 할 수 없다.
이는 I/O 기한이며 JS CPU 제한이 아니다.

클라이언트는 TLS·비동기 DNS를 지원하는 시스템 libcurl >=8.13.0을 요구한다.
HTTP/HTTPS만 허용하며 URL 자격 증명·NUL·제어 문자를 거부한다.
TLS peer·hostname 검증을 유지하고 rejectUnauthorized:false를 거부한다.
HTTPS에서 HTTP로 낮아지는 redirect와 자동 환경 프록시는 허용하지 않는다.
caFile은 명시적 별도 CA 경로이며 timeout은 I/O 전송 기한이다.

Blob·버퍼 Request/Response·multipart는 최대 4 MiB다. Blob 입력은 복사하고 slice/read 결과도
사용자가 private 바이트를 바꾸지 못하게 분리한다. 본문 수집기는 각 청크를 별도 복사하며 소비는 한 번이다.
FormData는 최대 1024개 필드이며 multipart 경계는 OS 난수로 만들고 이름·파일 이름의
quote/CR/LF/NUL을 escape한다. 엔진 메모리와 사용자 객체 내부 크기까지 제한하는 것은 아니다.
본문에서 유도한 Content-Type도 기존 요청 헤더 개수·바이트 한도에 포함한다.
네트워크 Response clone·File·Web byte/BYOB 모드 등 미지원 범위는 호환 문서에 명시한다.

Web Streams의 상태·대기 Promise·잠금은 context별 engine-owned WeakMap 그래프에 있다.
source/sink/transform과 Promise 반응은 소유 스레드에서 실행한다. 대체 Promise 큐는 없다.
읽기 대기·쓰기/tee 분기 큐는 각각 1024개로 제한하며 큐 초과는 오류와 원본 취소로 처리한다.
pipe 취소는 양쪽 정리를 기다리고 구독·lock을 해제한다. sink 취소 리스너의 예외도 실제 abort를 막지 않는다.
Readable.fromWeb은 생성 실패·정상 종료·destroy에서 reader lock을 회수한다.
이 제한은 임의 청크 객체의 내부 크기나 JS heap 전체를 제한하지 않는다.
TextEncoder/Decoder와 FormData 문자열은 공통 4 MiB 변환 예산을 사용한다.
JSON reviver의 원문 span은 wjson이 전체 문법을 검증한 뒤에만 읽으며 원래 입력을 한 번 변환한다.

## 설치·캐시·workspaces

설치기는 JS를 실행하지 않는 Wave 명령이다. HTTPS 검증·SHA-512 SRI·고정 잠금과 libarchive를
사용한다. archive의 경로 탈출·링크·특수 파일·중복 파일을 거부하며 0700 staging에
nofollow/O_EXCL descriptor 기준으로 쓴다. 무결성은 게시자 신뢰나 패키지 코드 안전성을 뜻하지 않는다.
설치 lifecycle scripts·bin 링크는 적용하지 않는다.

프로젝트 flock과 복구 journal로 협력하는 설치기를 직렬화한다. 교체는 UID·관리 표식·파일 형태·
기존 descriptor/hard-link 소유권 증거를 확인한 뒤 수행한다. 외부 교체 충돌은 기록과 백업을 보존한다.
파일·디렉터리를 fsync하지만 두 경로 게시의 crash-atomic 성질이나 실제 정전을 보장하지 않는다.

캐시는 관리 archive 전체 256 MiB·1024개이며 오래된 mtime부터 FIFO 정리한다.
전체 snapshot을 검증한 뒤 삭제하고, nofollow·현재 UID·단일 hardlink·inode/size/mtime 재확인을 적용한다.
미인식 사용자 파일은 보존한다. 캐시 정리로 offline에 필요한 archive가 없어지면 명시적으로 실패한다.

workspaces는 프로젝트 descriptor에서 상대 경로를 nofollow로 열고 정렬된 파일 스냅샷을 복사한다.
심볼릭 링크·hardlink·특수 파일·상위 경로를 거부하며 원본 트리를 변경하지 않는다.
name/version과 원본 manifest, 각 파일의 SHA-512 및 경로를 확인한다. frozen 모드는 소스 바이트
변경도 거부하며 실패 시 기존 설치를 보존한다. workspace와 archive는 전체 해제 바이트 예산을 공유한다.
개발용 symlink 방식이나 동일 계정의 악성 프로세스에 대한 격리를 제공하지 않는다.

## 빌드와 배포

빌드·검사·배포 조정은 Wave다. private 작업공간에서 전체 회귀를 검사하고 실패한 후보로
기존 실행 파일을 교체하지 않는다. ELF에는 PIE·RELRO·즉시 결합·실행 불가 스택을 적용한다.

배포 도구는 고정 파일 목록·SHA-256·UID·관리 표식과 세대 정체성을 확인한다.
Ed25519 검증에는 별도로 신뢰한 공개키가 필요하다. 외부 체크섬만으로 게시자를 인증하지 않는다.
운영 키·공개 서명본은 아직 없다. CI 설정은 fork PR의 self-hosted 실행을 허용하지 않고 token은 contents:read다.

실제 검사 결과·생략·산출물은 IMPLEMENTATION.md에 기록한다. 소켓이 거부된 환경은 TCP 묶음을
SKIP으로 보고하며 --require-tcp에서는 실패한다. 파서/API 검사 성공을 실제 통신 검증으로 세지 않는다.
현재 의존성 버전의 보안 업데이트 최신성이나 결함 부재를 보장하지 않는다.
