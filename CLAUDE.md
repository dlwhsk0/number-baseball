# 숫자 야구 (number-baseball)

세 자리 숫자를 맞히는 숫자 야구 게임 모바일 웹앱.

## 스택
- Vite + React + TypeScript
- 배포 대상: 모바일 웹(반응형) + PWA. Vercel 배포.
- **패키지 매니저는 pnpm.** Vite 8은 rolldown 네이티브 바이너리를 쓰는데, npm은
  optional-deps 버그(npm/cli#4828)로 이 환경에서 바이너리를 못 받는다. pnpm은 정상.
  darwin(로컬)/linux(Vercel) 바이너리를 devDependencies에 직접 명시해 둠.

## 명령어
- 개발: `npm run dev`
- 빌드: `npm run build`
- 프리뷰: `npm run preview`
- 린트: `npm run lint`

## 게임 규칙
- 컴퓨터가 서로 다른 3자리 숫자(각 자리 0~9, 중복 없음)를 정한다. 단 맨 앞자리는 0이 올 수 없다.
- 플레이어가 3자리를 추측하면 판정:
  - **스트라이크(S)**: 숫자와 위치가 모두 맞음
  - **볼(B)**: 숫자는 있으나 위치가 틀림
  - **아웃(O)**: 하나도 없음
- 3스트라이크면 승리. 시도 횟수 제한 옵션(예: 10회).

## 기능
- **추측 기록**: 각 줄에 S·B·O를 고정 3칸으로 표시(합=3). 색은 야구 전광판 관례: S 주황 · B 초록 · O 빨강.
- **입력 칸**: `GameState.slots`(길이 3 배열, 빈 칸 ''). 칸을 탭하면 그 칸만 제자리에서 비워지고
  (구멍 허용), 다음 입력은 가장 왼쪽 빈 칸을 채운다. 제출은 세 칸이 모두 찼을 때만.
- **메모**: 입력 키패드에 통합. "메모 모드" 토글을 켜면 숫자 탭이 입력 대신 메모 표시를
  순환한다: 기본 → ○스트라이크 → △볼 → ✗아웃 → 기본. 배지는 판정 색과 대응(주황/초록/빨강).
  라운드마다 초기화. 메모는 표시 전용이라 입력을 막지 않음. 상태는 `GameState.memo`(`MemoMark`).
- **테마**: 시스템 다크/라이트 자동 감지 + 좌상단 해/달 토글(`src/components/ThemeToggle.tsx`).
  색 팔레트는 `src/index.css`의 `:root`(라이트 기본) / `:root[data-theme='dark']`로 정의하고
  `data-theme` 속성으로 전환. 수동 선택은 `localStorage.theme`에 저장, 없으면 시스템을 실시간 추종.
  `index.html`의 인라인 스크립트가 마운트 전에 테마를 확정(FOUC 방지). accent 위 글자는 `--on-accent`.
- **푸터**: GitHub 프로필 링크 아이콘(`github.com/dlwhsk0`).
- **게임 방법 모달**: 타이틀 아래 "게임 방법 보기"를 누르면 거의 전체 화면 모달(`src/components/RulesModal.tsx`)
  이 열려 규칙·판정·메모 모드를 설명. 좌상단 ✕/ESC/배경 탭으로 닫고, 열려 있는 동안 배경 스크롤 잠금.

## 빌드 단계 (체크리스트)
- [x] 단계 0: 스캐폴딩 + CLAUDE.md
- [x] 단계 1: 게임 로직(정답 생성 / 판정) + 단위 테스트
- [x] 단계 2: 입력 UI(모바일 친화 키패드) + 히스토리 표시
- [x] 단계 3: 승리/패배 상태 + 다시하기
- [x] 단계 4: 스타일 다듬기 + PWA
- [x] 메모 기능: 키패드 통합 메모 모드(○S·△B·✗O)

## PWA / 아이콘
- `vite-plugin-pwa`로 매니페스트·서비스워커 자동 생성(`registerType: 'prompt'`).
- **업데이트 방식**(`src/App.tsx`의 `useRegisterSW` + `src/components/UpdatePrompt.tsx`):
  - **확인**: 앱이 보일 때마다(`visibilitychange`) + 30분마다 `registration.update()`. 모바일/설치앱은
    껐다 켜도 '재개'만 되어 자동 확인이 안 돌기 때문에 visibility 기반으로 강제 확인한다.
  - **적용**: 빈 판(게임 시작 전: guesses 0·slots 빈칸·memo 없음)에서 업데이트가 잡히면 **조용히 즉시 적용**
    (`updateServiceWorker(true)`). 게임 중이면 하단 배너만 띄우고, "지금 새로고침" 또는 "새 게임/다시하기"를
    누를 때 적용 → 진행 중 초기화 방지.
  - 오프라인이면 마지막 캐시 버전으로 동작하고, 온라인 복귀 후 열면 확인·적용된다.
  - React 훅이 `workbox-window`(peer dep)를 요구해서 devDependencies에 명시(pnpm은 peer 자동설치 안 함).
  - 주의: SW 교체는 한 텀 늦다 — 새 로직은 사용자가 그 버전에 올라온 *다음* 배포부터 적용된다.
- 아이콘은 `scripts/gen-icons.mjs`로 SVG→PNG 생성해 `public/`에 커밋. 재생성하려면 `npm i -D sharp` 후 `node scripts/gen-icons.mjs`.

## 컨벤션
- 커밋 메시지: 한국어, 의미 단위. 배포는 `ship` 스킬 사용.
- 브랜치(하이브리드): 작은 수정은 `main` 직접, 기능 단위·실험·배포 붙은 작업은 `feat/xxx` 브랜치 → PR 머지.
- 데이터 모델 / 폴더 구조가 바뀌면 이 문서를 갱신한다.
