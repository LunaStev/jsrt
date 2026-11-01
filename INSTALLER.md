# 패키지 설치

설치·버전 선택·캐시·무결성·복구 정책은 Wave에 있다. manifest·registry·잠금은 wjson으로 처리한다.
설치 중 패키지 JS나 lifecycle scripts는 실행하지 않는다.

## 명령과 잠금

```sh
jsrt install --project ./app
jsrt install --project ./app --include-dev
jsrt install --project ./app --frozen-lockfile
jsrt install --project ./app --offline --replace
jsrt install --project ./app --update
```

기본은 production dependencies다. --include-dev는 루트 devDependencies를 추가하며 이름이 겹치면
production을 우선한다. registry 패키지의 devDependencies는 설치하지 않는다.
잠금의 includeDev 모드와 실행 모드가 다르면 frozen/offline 설치를 거부한다.

jsrt.lock.wjson v1에는 루트 manifest 무결성, 정확한 패키지 버전·위치·source·SHA-512와 optionalSkips를
기록한다. 잠긴 설치는 요구 범위·실제 archive package.json·무결성을 재검사한다.
--offline은 frozen이며 검증된 캐시·잠긴 file: archive·일치하는 로컬 workspace만 사용한다.
miss·손상은 네트워크로 우회하지 않는다. npm lockfile을 읽거나 쓰지는 않는다.

## 버전·optional·peer

정확한 버전, ^/~, 부분/wildcard, 비교식 AND/OR, hyphen, 명시적 prerelease 부분 문법을 지원한다.
적합한 stable 중 가장 높은 버전을 선택한다. prerelease는 같은 core의 prerelease comparator를
명시한 OR 그룹에서만 포함한다. build metadata는 우선순위에 영향을 주지 않는다.
느슨한 v 접두사·dist-tag·Git·일반 file dependency spec은 지원하지 않는다.
버전 256바이트·범위 512바이트·64 comparator·16 OR 그룹, registry 65536개 버전·4 MiB를 적용한다.

optionalDependencies는 같은 이름의 dependencies/devDependencies보다 우선한다.
새 선택 하위 트리의 설치 실패는 생성 경로·그래프를 되돌리고 optionalSkips에 기록한다.
롤백 실패나 잠금에 설치된 선택 패키지의 무결성 오류는 전체 설치 실패다.
os/cpu 조건과 생략 기록의 requirement·위치·미사용·중복을 검사한다.

peer는 요청 패키지의 부모 범위부터 조회한다. 이미 보이는 버전이 충돌하면 실패한다.
필수 peer가 없으면 같은 범위에서 이미 기록된 모든 peer 범위의 교집합을 만족하는 버전을 선택한다.
OR를 단순 문자열 AND로 변환하지 않는다. optional peer는 부재를 허용하지만 설치될 경우 범위를 검사한다.
설치 후 전체 peer 간선을 다시 검사한다. 생략된 선택 위치를 필수 peer로 다시 설치하지 않는다.
그래프 backtracking·전역 hoisting·지연 peer 충돌의 선택 subtree 자동 생략은 지원하지 않는다.

## 로컬 workspaces

루트 package.json의 workspaces 배열에 명시적 프로젝트 상대 경로 또는 마지막 /* 패턴을 쓴다.
각 선택 경로는 유효한 고유 name/version을 가진 package.json이 있는 디렉터리여야 한다.
상위 경로·절대 경로·링크·중첩 workspace 선언·그 밖의 glob은 거부한다.

모든 로컬 패키지를 먼저 관리 node_modules에 등록한 뒤 의존성을 연결하므로 로컬 순환 그래프도 처리한다.
로컬 패키지를 가리키는 workspace:*, workspace:^, workspace:~, workspace:<지원 범위>와
일치하는 일반 SemVer 범위를 받는다. 로컬 버전과 충돌하는 요구는 실패한다.
루트 dependencies에 없는 선언 workspace도 설치한다. workspace의 devDependencies는 현재 선택하지 않는다.

설치는 개발 소스 링크가 아닌 관리 스냅샷이다. 원본에 node_modules나 symlink를 만들지 않는다.
원본 디렉터리를 nofollow로 열고 이름을 정렬해 파일·디렉터리를 복사한다. symlink·hardlink·특수 파일을 거부한다.
.git, node_modules, .jsrt-cache, .jsrt-transaction, jsrt.lock.wjson은 스냅샷에서 제외한다.
잠금의 resolved는 workspace:<상대 경로>, integrity는 경로와 모든 파일 digest를 포함한 스냅샷 SHA-512다.
frozen/offline은 package.json이 같아도 원본 소스 바이트가 달라지면 실패하며 이전 설치를 보존한다.
원본을 바꾼 스냅샷을 설치하려면 --update로 명시적으로 갱신한다.

## 캐시

프로젝트 .jsrt-cache의 archive는 canonical SHA-512 이름으로 저장하고 매번 크기·파일 형태·SHA-512를 검증한다.
임시 archive는 transaction 안에 쓰고 fsync·NOREPLACE로 게시한다. 기존 항목을 덮어쓰지 않는다.
archive당 32 MiB, 관리 archive 합계 256 MiB·1024개를 적용한다.
새 게시 전 오래된 mtime부터 FIFO 정리하며 조회 시각으로 갱신하지 않는다.

정리는 전체 snapshot 검증 뒤 진행하고 nofollow·UID·단일 hardlink·삭제 직전 inode/size/mtime을 확인한다.
미인식 이름은 사용자 파일로 보존하며 관리 바이트 합계에서 제외한다.
캐시는 offline 영구 보관소가 아니며 정리 후 필요한 archive가 없으면 설치가 실패한다.

```sh
jsrt cache prune --project ./app
jsrt cache prune --project ./app --max-mb 64 --max-entries 128
jsrt cache prune --project ./app --max-mb 0 --max-entries 0
```

명령별 한도는 컴파일된 상한을 높이지 못하며 설치와 같은 프로젝트 flock·복구를 사용한다.
설치된 dependency tree를 지우지는 않는다.

## 게시·교체·복구

기본 설치는 기존 node_modules를 덮어쓰지 않는다. --replace는 기존 잠금으로 관리 트리 전체를 다시 만든다.
--update는 범위를 다시 해석하고 잠금과 관리 트리를 갱신하며 offline/frozen과 함께 쓰지 못한다.
기존 관리 트리의 사용자 수정도 교체 대상이다.

프로젝트 flock을 manifest 읽기 전부터 정리 완료까지 유지한다. UID·관리 표식·일반 파일·nofollow를 확인하고
새 staging 검증을 끝낸 뒤 기존 descriptor와 hard-link 소유권 증거, v2 journal을 보존해 exchange rename한다.
파일·디렉터리를 fsync하고 v1/v2 journal을 복구한다. 두 경로의 게시를 하나의 crash-atomic 동작으로 보장하지 않는다.

트리 게시 전 중단은 이전 잠금을 복원하고, 게시 후에는 새 세대를 유지해 이전 백업을 정리한다.
외부 교체나 소유권 충돌은 백업·journal을 보존하고 실패한다. 협조하지 않는 외부 쓰기를 차단하지는 않는다.

## 한도와 검증

패키지·설치 시도·peer·생략은 각각 256개, 그래프/소스 깊이 32, 생성 경로 8192개,
경로 4095바이트, 개별 archive/파일 32 MiB, archive+workspace 전체 해제 256 MiB다.
workspaces discovery/각 스냅샷에도 별도의 항목·바이트 예산을 적용한다. 실제 값은 --info를 따른다.

영구 회귀는 SemVer·peer 교집합, 파일 기반 잠금 설치, 캐시·교체·SIGKILL 복구,
workspace 순환·frozen 재설치·변경/링크 거부·실패 시 기존 실행 보존을 검사한다.
실제 registry/앱 검사는 ./bootstrap.sh test-npm --engine-library <path> --require-tcp로 별도 실행한다.
최종 결과와 네트워크 제약은 IMPLEMENTATION.md에 기록한다.

private registry 인증·scripts/bin·npm lockfile·일반 glob/개발 링크 workspaces와 고급 충돌 풀이는 남아 있다.
SHA-512 일치는 게시자 신뢰·코드 안전성·npm provenance 인증이 아니다.
