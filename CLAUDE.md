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
- 컴퓨터가 서로 다른 숫자(각 자리 0~9, 중복 없음)를 정한다. 단 맨 앞자리는 0이 올 수 없다.
- 자릿수는 난이도에 따라 3 또는 4자리. 추측하면 판정:
  - **스트라이크(S)**: 숫자와 위치가 모두 맞음
  - **볼(B)**: 숫자는 있으나 위치가 틀림
  - **아웃(O)**: 하나도 없음
- 모든 자리가 스트라이크면 승리. 시도 10회 제한.
- **난이도**(`LEVELS` in `src/game/useGame.ts`): 초보자(3자리+자동 힌트) / 중급(3자리) / 고급(4자리).
  자릿수·자동 힌트 여부는 `GameState.digits`·`GameState.beginner`에 담기고, 선택은 `localStorage.level`에 저장.
  초보자 자동 힌트: 제출이 3아웃(전부 없음)이면 그 숫자들을 자동으로 아웃 메모 표시(reducer의 submit).

## 기능
- **컨트롤**(`.controls`, 정답존 위 2행): **타이틀·부제 없음**(인트로에서만). 밝기 토글 없음(단일 다크).
  - 1행: `[?]`(좌) · `[ 혼자 | 멀티 ]` 세그먼트 토글(우, `section`). 이 토글이 모드 전환을 다 담당(옛 `멀티 ▶`/`◀ 혼자` 버튼 대체).
  - 2행: 혼자일 땐 `[ 초보자 | 중급 | 고급 ]` 세그먼트(좌) · `[↻ 새 게임]`(우). 멀티일 땐 `[ 스피드 대결 | 턴제 대결 ]` 세그먼트(`multiMode`).
  - 혼자일 때 그 아래 작은 `level-caption`(자릿수·자동 힌트). 세그먼트는 전부 `.seg`/`.seg-btn`(활성=그린) 공용.
- **시작 인트로**(`src/components/Intro.tsx`): 앱을 열면 전광판이 켜지는 연출(세그먼트 플리커)로 타이틀을 잠깐 띄운다.
  **세션당 1회**(`sessionStorage.nb_intro`), ~1.8초 후 자동 또는 탭하면 즉시 닫힘. App의 `showIntro`가 제어.
- **대결 모드**(App `section='multi'`): 컨트롤 2행의 `[온라인 | 스피드 | 턴제]` 세그먼트(`multiMode`, 기본 온라인)로 선택.
  스피드·턴제는 **한 기기 패스앤플레이**(서버 없음), 온라인은 **서버 대전**. 혼자로 복귀는 `혼자|멀티` 토글 또는 각 화면의 `onExit`.
  - **스피드 대결**: `src/versus/SpeedVersus.tsx`. 공통 숫자 1개를 2~4명이 번갈아(핸드오프 화면으로 이전 기록 숨김)
    무제한 시도로 풀고, 적은 횟수→빠른 시간 순으로 승자. 라이브 타이머. 각 턴은 `GuessBoard`(순수 `gameReducer` 재사용)로.
  - **턴제 대결**: `src/versus/DuelVersus.tsx`. 일대일. 서로 상대가 맞힐 숫자를 몰래 정하고(핸드오프),
    번갈아 한 번씩 상대 숫자를 추측. 공정성: 선공(P1)이 맞히면 후공(P2)에게 같은 라운드 마지막 기회 → 둘 다 맞히면 무승부.
    비밀 입력·턴 입력은 `Keypad`의 `showMemo={false}`로 메모 버튼 숨김.
  - **온라인 대결**: `src/versus/OnlineDuel.tsx` + `src/net/`(`socket.ts` 단일 소켓, `protocol.ts` 이벤트 타입).
    (기획·아키텍처·트러블슈팅 상세: [`docs/online-multiplayer-design.md`](docs/online-multiplayer-design.md),
    [`docs/online-troubleshooting.md`](docs/online-troubleshooting.md).)
    턴제 규칙을 **서버 권위**로. 방 코드로 1:1 입장 → 비밀 설정 → 턴 동기화 → 결과·재대결. 로컬 상태는 서버 이벤트로만 전이.
    서버는 `server/`(Node+Socket.IO, 정답 보관·판정). 접속 주소는 `VITE_SERVER_URL`(개발 기본 `http://localhost:3001`, 배포 `wss://도메인`).
    `protocol.ts`는 `server/src/types.ts`와 동일하게 유지. 규칙 로직 `logic.ts`는 프론트·서버 양쪽에 복제(함께 수정).
    **재접속 복구**: 끊겨도 서버가 방을 바로 안 지우고 유예(`GRACE_MS` 기본 90s — 모바일 백그라운드 대비 넉넉히).
    클라는 세션(코드·자리·토큰)을 **`sessionStorage`(`nb_online_session`)에 저장** → 탭이 리로드/백그라운드 복귀해도 마운트 시 복원해 자동 `rejoin`(그동안 "방에 다시 연결하는 중" 화면, 9s 타임아웃 폴백).
    소켓 재연결 시 `rejoin`으로 다시 합류하고 `resume`으로 상태 동기화. 나가기·방 만료·상대 이탈 시 세션 삭제. (`opponentDisconnected/Reconnected` 알림, `NetStatus` 배너.)
    Socket.IO는 폴링 폴백 + 관대한 ping(`pingTimeout` 40s). **서버 코드 바꾸면 VM 재배포 필요**(`git pull && pnpm build && pm2 restart nb-server`).
    연출: 추측 후 **결과 발표 텀**(서버 `reveal` → `REVEAL_MS` 뒤 turn/over, 그동안 `pending`으로 입력 차단), 특이 이벤트 리액션,
    상대 입장 직후 **VS 매치업 연출**(`vsIntro` — `phase` 이벤트 받으면 양쪽 닉네임 슬라이드+`VS` 팝 ~2.4초 뒤 비밀 정하기로. 재대결도 동일, 재접속 복귀 땐 생략),
    선공이 맞히면 후공 **역전 찬스**, 시작 발표, 상대 대기 랜덤 멘트, **내 숫자 peek**(블러+눌러서 토글 확인/숨김),
    **상대 실시간 입력 미리보기**(`input`/`opponentInput` 중계), 재대결 신청 알림(`rematchRequested`), 승/패 강조 결과 화면.
    플레이 화면 레이아웃: 상단 **상태 슬롯**(`.play-stage` — 발표/개시/상대입력·대기만 여기) → **고정 키패드**(`OnlineInput`의 `active`;
    내 차례엔 입력, 상대 차례엔 메모 전용으로 항상 표시) → **기록 탭**(`histTab` 내/상대). 키패드·기록 탭은 턴과 무관하게 자리 고정.
- **`GuessBoard`**(`src/components/GuessBoard.tsx`): 입력칸+키패드+메모+히스토리를 묶은 재사용 보드. 정답·자릿수·onWin을 받는다.
- **난이도 선택**(혼자 모드): 헤더 아래 세그먼트 컨트롤(초보자/중급/고급). 고르면 그 난이도로 새 판 시작.
  진행 중인 판(입력·추측·메모 있음)에서 바꾸면 `ConfirmDialog`로 확인받는다(빈 판이면 바로 전환).
- **추측 기록(history)**: 각 줄에 추측(미니 세그먼트 셀) + S·B·O를 **전구 그룹**으로 표시 — 항목마다 라벨(S/B/O) 아래
  자릿수만큼의 전구가 카운트만큼 점등(합=자릿수, O=자릿수-S-B). 색은 전광판 관례: S 주황 · B 초록 · O 빨강.
  섹션 라벨은 `history`. (정답존 아래엔 램프를 두지 않음 — 기록과 중복이라 제거)
- **입력 칸**: `GameState.slots`(길이 digits, 빈 칸 ''). 칸을 탭하면 그 칸만 제자리에서 비워지고
  (구멍 허용), 다음 입력은 가장 왼쪽 빈 칸을 채운다. 제출은 모든 칸이 찼을 때만.
  칸(`.slot`)은 `container-type: inline-size` 컨테이너 → 세그먼트 폰트를 `cqw`(칸 너비)로 잡아 3·4자리 무관하게 칸에 딱 맞게(밀림 방지).
- **결과 화면**: 혼자·멀티가 같은 카드 스타일(`.online-result`). 혼자는 `ResultBanner`가 `solo-result` 변형으로 이모지+헤드라인+정답 카드(WIN 뱃지)+다시하기.
- **추측 발표 카드**(`src/components/RevealCard.tsx`, 온라인·혼자 공용): 큰 숫자 + S·B·O 전구 + 특이 이벤트 멘트(쓰리아웃/올볼/한 끗/정답).
  일반 결과는 **하얀 테두리**, 특이 이벤트는 **색 테두리(굵게)+슬램 등장+색 발광 펄스**로 확연히 구분. `tone='mine'`이면 그린 테두리(온라인 내 결과).
  혼자 모드는 추측할 때마다 이 카드가 입력 위로 1.5초 팝업(`.solo-reveal`, `pointer-events:none`이라 입력 안 막음). 승리/패배 추측은 카드 대신 결과 화면으로.
- **메모**: 입력 키패드에 통합. 하단 액션 줄은 `[메모(정사각·아이콘)] [확인(넓게)] [⌫지우기(정사각·아이콘)]`
  이고, 메모 버튼이 항상 이 줄에 있다. **메모 버튼 = 활성 표시 선택기**: 누를 때마다 `없음(입력) → ✕아웃 → △볼 → ○스트라이크 → 없음`
  으로 순환(아웃부터 — 제일 자주 씀). 버튼엔 현재 표시(✕/△/○)가 뜨고 그 표시 색으로 발광한다.
  **숫자 탭 = 토글**: 고른 표시를 붙였다(같은 표시면) 뗀다(순환 아님). 로직은 `useGame`의 `cycleMemoMark`(선택기 순환)·`toggleMemoMark`(숫자 토글).
  선택기 상태는 각 화면의 로컬 `memoMark`(혼자=App, 스피드=GuessBoard, 턴제=DuelTurn, 온라인=OnlineInput/MemoPad). `Keypad`은 `memoMark`+`onCycleMemo`+`onMemo(d,mark)`로 제어.
  메모 전용 화면(온라인 상대 차례·비밀 정하는 중)은 선택기가 `아웃↔볼↔스트라이크`만 순환(끄기 없음, `cycleMemoMark(m,false)`). `MemoPad`는 입력칸 없는 메모 전용 키패드.
  표시는 키 전체를 덮는 큰 도형(워터마크), 색은 판정색 대응(주황/초록/빨강). 새 게임마다 초기화. 표시 전용이라 입력을 막지 않음. 상태는 `GameState.memo`.
- **디자인 시스템**: **야구장 전광판(스코어보드)** 컨셉. 순검정 보드에 세븐세그먼트 LED 숫자.
  **다크가 무조건 기본**(전광판은 어두운 세계 — 로드 시 항상 다크, `index.html`에 테마 스크립트 없음).
  라이트('주간 경기' 팔레트)는 **이스터에그**: 혼자 화면의 `history` 라벨을 길게 누르면(약 0.8초) 전환(`App`의 `dayMode`가 `data-theme='light'` 세팅).
  **세션 한정**(저장 안 함 → 새로고침하면 다시 다크). 라이트 토큰은 `index.css`의 `:root[data-theme='light']`(밝은 보드·어두운 LCD 세그먼트·은은한 발광).
  포인트색은 **그린+화이트 믹스**: 숫자(판독값)는 화이트(`--led`), 그린(`--accent` `#4dff5e`)은 액센트 —
  확인 버튼·헤더 발광·활성 컨트롤, 그리고 **정답(입력) 칸의 세그먼트/발광**. S·B·O 램프색은 주황·초록·빨강.
  - **토큰**(`src/index.css` `:root`, 단일 다크): `--bg`(#000)·`--cell`·`--key`·`--panel(-2)`,
    `--led`/`--glow`(화이트 판독값), `--accent`/`--accent-glow`/`--on-accent`(그린), S·B·O(`--strike/ball/out`)+`--bulb-off`,
    라운드 `--r-sm/md/lg`(각지게), 텍스트 숫자용 `--font-digit`(카운트·타이머·점수 등 비(非)세그먼트 자리).
  - **`Seg7`**(`src/components/Seg7.tsx`): 세븐세그먼트 숫자 한 자리. 세그먼트 7개를 CSS로 그려 **외부 폰트 불필요**
    (오프라인 PWA 안전). 켜진 세그먼트 발광 + 꺼진 세그먼트 고스트. 색·크기는 부모 `font-size`(em)·`--led`로 제어.
    스크린리더용 실제 값은 `.sr-only`. **입력칸·키패드·기록 숫자 전부 `Seg7`**.
  - **B·S·O 전구**: 전광판 카운트등처럼 전구로 점등. `History`의 각 기록 행에서 S·B·O 카운트를 전구로 표시
    (`.hsbo` + `.lamp-{strike,ball,out}` + `.bulb.on`). 게임 판정이 곧 스트라이크·볼·아웃이라 딱 맞물림.
  - **셀(`.cell`)**: 숫자 블럭 공용 셀(검정+안쪽 그림자). 정답칸(`.slot`)은 **프레임 없이** 큰 그린 세그먼트만,
    키패드 키(`.key-digit.cell`)는 화이트 세그먼트 정사각, 기록은 미니 셀(`.hcell`).
  - **모션**: '적당히' — 슬롯 팝, 기록 행 등장, 램프 점등, 승리 `win-pulse`. `prefers-reduced-motion`이면 전부 정지(`index.css`).
  - `index.html` 인라인 스크립트/`theme-color`(#000)는 단일 다크라 사실상 고정. accent 위 글자는 `--on-accent`.
- **푸터**: GitHub 로고 버튼. **이스터에그 2**: 여러 번(7회) 누르면 '개발자 모드' 해금 — 토스트 멘트가 뜨다가
  마지막에 인사말+프로필 링크 모달(`App`의 `devUnlocked`). (이스터에그 1은 `history` 롱프레스 라이트 모드.)
- **게임 방법 모달**: 헤더 좌측 상단 `?` 원형 버튼을 누르면 거의 전체 화면 모달(`src/components/RulesModal.tsx`)
  이 열려 규칙·판정·메모 모드를 설명. 좌상단 ✕/ESC/배경 탭으로 닫고, 열려 있는 동안 배경 스크롤 잠금.

## 빌드 단계 (체크리스트)
- [x] 단계 0: 스캐폴딩 + CLAUDE.md
- [x] 단계 1: 게임 로직(정답 생성 / 판정) + 단위 테스트
- [x] 단계 2: 입력 UI(모바일 친화 키패드) + 히스토리 표시
- [x] 단계 3: 승리/패배 상태 + 다시하기
- [x] 단계 4: 스타일 다듬기 + PWA
- [x] 메모 기능: 키패드 통합 메모 모드(○S·△B·✗O)

## PWA / 아이콘
- `vite-plugin-pwa`로 매니페스트·서비스워커 자동 생성(`registerType: 'autoUpdate'`).
- **업데이트 방식**(`src/App.tsx`의 `useRegisterSW`): **팝업 없음.** 새 버전은 백그라운드에서 자동 설치되고
  **다음 실행 때 적용**된다. `onRegisteredSW`에서 앱이 보일 때마다(`visibilitychange`) + 1분마다 `registration.update()`로 확인.
  진행 중 강제 리로드는 하지 않음(온라인 대전 끊김 방지). React 훅은 `workbox-window`(peer dep) 필요 → devDependencies에 명시.
  주의: SW 교체는 한 텀 늦다 — 새 로직은 그 버전에 올라온 *다음* 실행부터 적용.
- 아이콘은 `scripts/gen-icons.mjs`로 SVG→PNG 생성해 `public/`에 커밋. 야구공(흰 원+빨간 실밥)을 검정 타일(`#08090c`)에.
  공 반지름은 `(0.5-pad)*0.62`로 타일 대비 작게(여백). 재생성: `pnpm add -D sharp` 후 `node scripts/gen-icons.mjs`
  (sharp는 애드혹 — 생성 후 `git checkout package.json pnpm-lock.yaml`로 의존성 되돌림).

## 컨벤션
- 커밋 메시지: 한국어, 의미 단위. 배포는 `ship` 스킬 사용.
- 브랜치(하이브리드): 작은 수정은 `main` 직접, 기능 단위·실험·배포 붙은 작업은 `feat/xxx` 브랜치 → PR 머지.
- 데이터 모델 / 폴더 구조가 바뀌면 이 문서를 갱신한다.
