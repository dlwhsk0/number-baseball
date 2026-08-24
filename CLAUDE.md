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
- **자릿수·힌트**(독립, `src/game/useGame.ts`): **자릿수**(3/4)와 **힌트**(개인 기능)는 별개.
  자릿수는 `localStorage.nb_digits`, 힌트는 `nb_hint`에 저장(옛 `level` 값 자동 이관). `GameState.digits`·`GameState.beginner`(=힌트).
  **힌트**(자릿수 무관, reducer submit): 제출이 전부 아웃이면 그 숫자들 자동 ✕(아웃) 메모, **0아웃(S+B=자릿수, 전부 있음)이면 △(볼=있음) 메모**(이미 스트라이크 확정한 건 유지). `setHint`로 라이브 토글, 자릿수 변경만 새 판.

## 레이아웃 개편(야구장 컨셉)
- **무스크롤**: `.app`은 `height:100dvh; overflow:hidden` — 페이지 전체 스크롤 없음. 넘치면 안쪽(전광판 기록/`.versus`)만 스크롤.
- **솔로 배치**: 상단 **전광판**(`.scoreboard` — 기록, 게임 종료 시 결과 발표) → 하단 **타자석**(`.board.batter-box` — 입력칸+키패드+홈플레이트 꼭짓점).
- **배경**(`src/components/FieldBackdrop.tsx`, `.field-bg`): 타자석에서 본 그라운드(잔디·내야·베이스·마운드·홈플레이트) SVG. 종횡비(400/700) 고정으로 균일 스케일, 일부러 화면 밖으로 넘치게(하단 앵커). 위로 페이드(mask).
- **글라스(iOS)**: 다크 토큰의 `--panel/-2·--cell·--key·--border`가 반투명 rgba. 주요 박스·팝업에 `backdrop-filter: blur(--glass-blur)` → 뒤 야구장이 비침. (라이트 테마는 불투명 유지.)

## 기능
- **컨트롤**(`.controls`): **타이틀·부제 없음**(인트로에서만). 밝기 토글 없음(단일 다크).
  - 1행: `[?]`(좌, 첫 방문 시 `.help-callout` 말풍선) · `[ 솔로 | 멀티 ]` 세그먼트(`section`) · **`[⚙]`**(우, 솔로만 — 설정 시트).
  - **설정 시트**(`⚙` → `.settings-sheet` 모달): **자릿수 [3자리|4자리]** · **힌트 [끔|켬]** · `↻ 새 게임`.
  - 멀티는 헤더에 별도 세그먼트 없음(아래 **멀티 시작 메뉴** 카드가 전부 담당). `⚙` 자리는 `.gear-spacer`.
  - 세그먼트는 전부 `.seg`/`.seg-btn`(활성=그린) 공용.
- **시작 인트로**(`src/components/Intro.tsx`): 앱을 열면 전광판이 켜지는 연출(세그먼트 플리커)로 타이틀을 잠깐 띄운다.
  **세션당 1회**(`sessionStorage.nb_intro`), ~1.8초 후 자동 또는 탭하면 즉시 닫힘. App의 `showIntro`가 제어.
- **대결 모드**(App `section='multi'`): **멀티 시작 메뉴** — 하나의 글라스 카드(`.online-menu-card`)에 위→아래로
  **닉네임 입력**(`mNick`, `localStorage.nb_nick`) · **자릿수 `[3|4]`**(`mDigits`) · **종류 `[⚡스피드|🥎주고받기]`**(`gameType`, 아래 한 줄 설명 `.mode-desc`),
  그 아래 **버튼 3개**: `[방 만들기]`·`[코드로 입장]`(CODE 입력칸 동반)·`[오프라인으로 하기]`. 앞 둘은 온라인(오프라인이면 `disabled`+토스트), 마지막은 로컬(패스앤플레이).
  **코드로 입장은 모드 무관** — 먼저 `peek`(부수효과 없는 방 조회, `src/net/peek.ts`)으로 방장이 만든 모드·자릿수를 받아 그 모드로 자동 진입(`peeking` 중 "확인 중…").
  (`gameType`은 방 만들기·로컬에만 쓰임. 종류 라벨은 `duel`='주고받기'로 표기하지만 코드·프로토콜은 그대로 `duel`.)
  버튼을 누르면 `launch`(`{conn,gameType,action,code?}`)가 세팅되어 해당 화면으로 진입, 각 화면의 `onExit`가 `launch=null`로 메뉴 복귀.
  - 온라인 컴포넌트(`OnlineSpeed`/`OnlineDuel`)는 **액션 구동식**: `entry={{action:'create'|'join', nick, digits, code}}` + `onExit`를 받아
    연결되면 자동으로 `doCreate`/`doJoin` 실행(`autoRanRef` 가드), 자체 메뉴 없이 로딩 화면만. 로컬은 `SpeedVersus`/`DuelVersus`(자체 셋업 유지).
  로컬=한 기기 패스앤플레이(`SpeedVersus`/`DuelVersus`, 서버 없음), 온라인=서버 대전(`OnlineSpeed`/`OnlineDuel`). 온라인은 스피드·턴제 **둘 다** 지원.
  - **온라인 스피드**: `src/versus/OnlineSpeed.tsx` + 서버 speed 모드. 방 만들기/코드 입장(2~6명) → 방장 시작 → **공통 숫자를 전원 동시 레이스**(서버 판정) → 라이브 리더보드(순위·점수·시간) → **전원 맞히면 종료**. 세션 재접속 지원(`nb_speed_session`).
    - **순위 = 합산 점수**(낮을수록 상위): `점수 = 추측 횟수 + 시간(초)/SCORE_SEC_PER_POINT`(기본 20초=1점, `server`에서 계산해 `SpeedStanding.score`로 전달). 지연 페널티 없음(총 시간이 점수에 반영). 미해결은 solved 뒤에 시도수 순.
    - **제한시간 자릿수별**: 3자리 5분·4자리 7분(`SPEED_LIMIT_3_MS`/`SPEED_LIMIT_4_MS`, `speedLimitMs(digits)`). 만료 시 그 시점 순위로 강제 종료. 진행 중 상대 다 나가면 종료(기권승).
    서버: 방 `mode:'duel'|'speed'`, 스피드는 `speedSecret`·플레이어별 `solved/attempts/solveMs/history`·`gone`. 이벤트 `startSpeed`/`speedStart`(payload `limitMs`)/`speedRoster`/`speedProgress`/`speedOver`/`speedReset`.
  - **스피드 대결**: `src/versus/SpeedVersus.tsx`. 공통 숫자 1개를 2~6명이 번갈아(핸드오프 화면으로 이전 기록 숨김)
    무제한 시도로 풀고, 적은 횟수→빠른 시간 순으로 승자. 라이브 타이머. 각 턴은 `GuessBoard`(순수 `gameReducer` 재사용)로.
  - **턴제 대결**: `src/versus/DuelVersus.tsx`. 일대일. 서로 상대가 맞힐 숫자를 몰래 정하고(핸드오프),
    번갈아 한 번씩 상대 숫자를 추측. 공정성: 선공(P1)이 맞히면 후공(P2)에게 같은 라운드 마지막 기회 → 둘 다 맞히면 무승부.
    비밀 입력·턴 입력은 `Keypad`의 `showMemo={false}`로 메모 버튼 숨김.
  - **온라인 대결**: `src/versus/OnlineDuel.tsx` + `src/net/`(`socket.ts` 단일 소켓, `protocol.ts` 이벤트 타입).
    (기획·아키텍처·트러블슈팅 상세: [`docs/online-multiplayer-design.md`](docs/online-multiplayer-design.md),
    [`docs/online-troubleshooting.md`](docs/online-troubleshooting.md).)
    턴제 규칙을 **서버 권위**로. 방 코드로 1:1 입장 → 비밀 설정 → 턴 동기화 → 결과·재대결. 로컬 상태는 서버 이벤트로만 전이.
    서버는 `server/`(Node+Socket.IO, 정답 보관·판정). 접속 주소는 `VITE_SERVER_URL`(개발 기본 `http://localhost:3001`, 배포 `wss://homerun.techeer.cloud-yaho.cloud`).
    `protocol.ts`는 `server/src/types.ts`와 동일하게 유지. 규칙 로직 `logic.ts`는 프론트·서버 양쪽에 복제(함께 수정).
    **재접속 복구**: 끊겨도 서버가 방을 바로 안 지우고 유예(`GRACE_MS` 기본 90s — 모바일 백그라운드 대비 넉넉히).
    클라는 세션(코드·자리·토큰)을 **`sessionStorage`(`nb_online_session`)에 저장** → 탭이 리로드/백그라운드 복귀해도 마운트 시 복원해 자동 `rejoin`(그동안 "방에 다시 연결하는 중" 화면, 9s 타임아웃 폴백).
    소켓 재연결 시 `rejoin`으로 다시 합류하고 `resume`으로 상태 동기화. 나가기·방 만료·상대 이탈 시 세션 삭제. (`opponentDisconnected/Reconnected` 알림, `NetStatus` 배너.)
    **방장 소유 방 수명**(턴제): 방은 방장(index 0) 소유. **방장이 나가면 방 종료**(후공은 결과 화면), **후공이 나가면 방장은 방을 유지한 채 다시 대기(lobby)**(`resetDuelToWaiting`, 새 상대 입장 가능). 끊김도 유예 후 같은 규칙. 클라의 `opponentLeft`는 내 index로 분기(방장=대기 복귀, 후공=종료). **승패(`over`) 나면 저장 세션 해제**(새로고침·실수 이탈해도 재접속 안 함), 재대결 시작(`phase`) 때 다시 저장.
    Socket.IO는 폴링 폴백 + 관대한 ping(`pingTimeout` 40s). **배포는 Dokploy**(셀프호스팅, Docker+Traefik). 방 상태가 메모리에만 있어 **반드시 단일 인스턴스(replicas=1)**.
    (상세 절차·트러블슈팅: [`docs/dokploy-deploy.md`](docs/dokploy-deploy.md).)
    루트 **`Dockerfile`**(루트 컨텍스트에서 `server/`만 빌드, Node22-alpine·pnpm·`/health`)로 빌드. Dokploy는 GitHub(`dlwhsk0/number-baseball`, `main`) 연동 → **`main`에 push하면 자동 재배포**(Webhook). 도메인 `wss://homerun.techeer.cloud-yaho.cloud`(Techeer 공유 Dokploy, `*.techeer.cloud-yaho.cloud` 와일드카드 DNS + Traefik Let's Encrypt), 컨테이너 포트 3001, env `CORS_ORIGIN`=프론트 Vercel 주소. 라이브 스모크: `URL=https://homerun.techeer.cloud-yaho.cloud node server/test/<name>.mjs`.
    (옛 오라클 VM + Caddy + pm2 방식은 **폐기·제거됨**(관련 스크립트/설정 삭제, 이력은 태그 `v1.0.0-pre-dokploy`) — 롤백 필요 시 Vercel `VITE_SERVER_URL`을 옛 주소 `wss://b-ball.duckdns.org`로.)
    연출: 추측 후 **결과 발표 텀**(서버 `reveal` → `REVEAL_MS` 뒤 turn/over, 그동안 `pending`으로 입력 차단), 특이 이벤트 리액션,
    상대 입장 직후 **VS 매치업 연출**(`vsIntro` — `phase` 이벤트 받으면 양쪽 닉네임 슬라이드+`VS` 팝 ~2.4초 뒤 비밀 정하기로. 재대결도 동일, 재접속 복귀 땐 생략),
    선공이 맞히면 후공 **역전 찬스**, 시작 발표, 상대 대기 랜덤 멘트, **내 숫자 peek**(블러+눌러서 토글 확인/숨김),
    **상대 실시간 입력 미리보기**(`input`/`opponentInput` 중계), 재대결 신청 알림(`rematchRequested`), 승/패 강조 결과 화면.
    플레이 화면 레이아웃: 상단 **전광판**(좌 내 기록·우 상대 기록) → 하단 **고정 타자석**(`GuessPad`의 `stageContent`로 발표/상대입력·대기 스왑,
    `active`로 내 차례=입력·상대 차례=메모 전용, 키패드 자리 고정). 비밀 정하기·메모 대기도 `GuessPad`(variant/showInput).
- **`GuessPad`**(`src/components/GuessPad.tsx`, **모든 모드 공용 입력 보드**): 입력 세그먼트 + 키패드 + 메모(O/B/S) +
  자리별 후보 메모(길게 누르기)를 하나로 묶은 공용 컴포넌트. **판정은 안 함** — 입력 문자열만 구성해 `onSubmit(value)`로 넘긴다.
  솔로·로컬 스피드/주고받기·온라인 스피드/주고받기 6개 모드가 전부 이걸 쓴다(디자인·메모·키보드 입력 일원화).
  - `variant`: `'guess'`(메모·후보·[던지기]) / `'secret'`(비밀 숫자 정하기, 메모 없음·[확인]).
  - `active`(내 차례 아니면 입력·제출 off·메모만), `disabled`(종료 등 전부 off), `showInput`(false=메모 전용 키패드),
    `stageContent`(온라인 주고받기 스테이지 스왑), `boardClass`(예: `online-board` 프레임, `batter-box` 솔로), `overlay`(솔로 결과 카드), `resetSignal`(새 판·자릿수 변경 시 입력·후보 비움), `onChange`(실시간 미리보기 중계).
  - 메모(O/B/S)·후보 메모는 **controlled(prop 지정) 또는 내부 상태** 선택 — 솔로/주고받기/온라인은 부모 메모를 넘겨 유지, 스피드는 내부.
  - 입력칸 슬롯 관리는 `gameReducer`의 push/pop/clearSlot/reset만 재사용(secret='', 판정 안 씀).
- **`GuessBoard`**(`src/components/GuessBoard.tsx`): `GuessPad` + 자체 판정(`judge`)·히스토리. 로컬 스피드 한 턴에 사용. 정답·자릿수·onWin.
- **자릿수 선택**(설정 시트): `[3자리|4자리]`. 진행 중인 판에서 바꾸면 `ConfirmDialog` 확인(빈 판이면 바로). 힌트 토글은 라이브(확인 없음).
- **추측 기록(history)**: 각 줄에 추측(미니 세그먼트 셀) + S·B·O를 **전구 그룹**으로 표시 — 항목마다 라벨(S/B/O) 아래
  자릿수만큼의 전구가 카운트만큼 점등(합=자릿수, O=자릿수-S-B). 색은 전광판 관례: S 주황 · B 초록 · O 빨강.
  섹션 라벨은 `history`. (정답존 아래엔 램프를 두지 않음 — 기록과 중복이라 제거)
- **입력 칸**: `GameState.slots`(길이 digits, 빈 칸 ''). 칸을 탭하면 그 칸만 제자리에서 비워지고
  (구멍 허용), 다음 입력은 가장 왼쪽 빈 칸을 채운다. 제출은 모든 칸이 찼을 때만.
  칸(`.slot`)은 `container-type: inline-size` 컨테이너 → 세그먼트 폰트를 `cqw`(칸 너비)로 잡아 3·4자리 무관하게 칸에 딱 맞게(밀림 방지).
  **자리별 추리 메모**(솔로): 입력칸을 ~0.4초 **길게 누르면** 그 칸 후보 편집 — 키패드 위로 오버레이 팝업(0-9 토글, 레이아웃 안 밀림). 후보는 **칸 우상단 배지**(`.slot-cands`)로 겹쳐 표시(높이 영향 없음). 상태는 App의 `notes: string[][]`(자리별 후보, 새 판·자릿수 변경 시 초기화). 짧은 탭은 기존대로 지우기. (`GameState.locked`/`toggleLock` 로직은 남아있으나 현재 UI 미사용.)
- **결과 화면**: 혼자·멀티가 같은 카드 스타일(`.online-result`). **솔로는 결과를 전광판(상단)에서 발표**(`.score-result` 안에 `ResultBanner`); 게임 종료 시 하단 타자석은 사라짐.
- **추측 발표 카드**(`src/components/RevealCard.tsx`, 온라인·혼자 공용): 큰 숫자 + S·B·O 전구 + 특이 이벤트 멘트(쓰리아웃/올볼/한 끗/정답).
  일반 결과는 **하얀 테두리**, 특이 이벤트는 **색 테두리(굵게)+슬램 등장+색 발광 펄스**로 확연히 구분. `tone='mine'`이면 그린 테두리(온라인 내 결과).
  혼자 모드는 추측할 때마다 이 카드가 입력 위로 1.5초 팝업(`.solo-reveal`, `pointer-events:none`이라 입력 안 막음). 승리/패배 추측은 카드 대신 결과 화면으로.
- **메모**(분리 버튼): `Keypad`의 `markButtons` 모드 — 마크를 **분리 버튼 `[O][B][S][↺초기화]`**로 직접 고른다(옛 순환식 대체). 버튼은 **색상 글자**(O=빨강·B=초록·S=주황, `.mark-letter`), 도형 배지는 안 씀(키 워터마크엔 여전히 ✕△○). `↺`=메모 전체 초기화.
  **마크 선택 = 토글**(`onPickMark`, 같은 걸 다시 누르면 해제=입력 모드). **숫자 탭 = 토글**(고른 표시 붙였다 뗌, `toggleMemoMark`). `↺`=메모 전체 초기화(`clearMemo`/`onClearMemo`).
  솔로는 `markButtons`+`showSubmit`(그 아래 `[던지기][⌫]` 줄). 온라인 메모 전용(상대 차례·비밀 대기)은 `markButtons`만(제출 없음). 상태는 각 화면 로컬 `memoMark`(null=입력).
  제출(추측) 버튼 라벨은 **던지기**(솔로). 메모 전용(입력칸 없음)은 `GuessPad`의 `showInput={false}`.
  **물리 키보드 입력**: 숫자=입력(메모 모드면 메모), Backspace=지우기, Enter=제출(`Keypad`의 전역 keydown, 모달 열리면 무시).
  표시는 키 전체를 덮는 큰 도형(워터마크), 색은 판정색 대응(주황/초록/빨강). 새 게임마다 초기화. 표시 전용이라 입력을 막지 않음. 상태는 `GameState.memo`.
- **디자인 시스템**: **야구장(전광판+타자석)** 컨셉 + **iOS 글라스**. 짙은 네이비(`--bg #0a0d15`) 위 반투명 프로스티드 박스, 세븐세그먼트 LED 숫자.
  **다크가 기본**. 테마는 **설정 시트에서 [다크|라이트] 선택**(`App`의 `theme:'dark'|'light'|'doosan'`, `localStorage.nb_theme` 저장). `index.html` 인라인 스크립트가 페인트 전에 저장 테마를 복원(깜빡임 방지). 글라스는 다크/두산 전용(라이트는 불투명).
  라이트('주간 경기' 팔레트) 토큰은 `index.css`의 `:root[data-theme='light']`(밝은 보드·어두운 LCD 세그먼트·은은한 발광).
  **두산 베어스 테마**(`:root[data-theme='doosan']`, 네이비 바탕 + 레드 액센트)는 **숨은 이스터에그**: 설정 시트 우하단에 은은히 숨긴 `.doosan-egg`(로고, 현재 🐻 placeholder — 로고 파일 받으면 `<img src="/doosan-mark.png">`로 교체) 탭 시 전환. 다시 다크/라이트 고르면 해제. 테마 변경 시 `.egg-toast` 토스트.
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
  마지막에 인사말+프로필 링크 모달(`App`의 `devUnlocked`). (이스터에그 1은 설정 속 숨긴 로고 탭 → 두산 베어스 테마.)
- **게임 방법(튜토리얼)**: 헤더 좌측 상단 `?` 원형 버튼을 누르면 **단계별 튜토리얼**(`src/components/RulesModal.tsx`)이
  열린다(5단계, `.tut-*`, 상단 진행 점 + 하단 [이전]/[다음]/[시작하기]). ①소개·규칙 ②판정 S·B·O 워크드 예시
  ③**키패드 메모 직접 눌러보기**(`Keypad markButtons` 실동작) ④**칸 길게 눌러 후보 메모 직접 해보기**(400ms 롱프레스→`note-pop`, 숨은 기능 안내)
  ⑤대결·설정 요약. 좌상단 ✕/ESC/배경 탭으로 닫고, 열려 있는 동안 배경 스크롤 잠금.

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
- 아이콘은 `scripts/gen-icons.mjs`로 SVG→PNG 생성해 `public/`에 커밋. **야구 베이스 한 구석**(흰 정사각형을 45°
  다이아몬드로 크게 그려 위쪽 꼭짓점만 확대, 베벨 테두리 + 네온 그린 발광)을 검정 타일에. 재생성: `pnpm add -D sharp` 후 `node scripts/gen-icons.mjs`
  (sharp는 애드혹 — 생성 후 `git checkout package.json pnpm-lock.yaml`로 의존성 되돌림).
- **아이콘 변경 안내**(`App.tsx` `ICON_VERSION`): 아이콘 바꾸면 `ICON_VERSION`을 올린다. 기존 사용자(써 본 흔적 있음)에게 하단 배너 1회 —
  **설치 가능(브라우저·미설치)이면 `beforeinstallprompt`로 [설치하기] 한 번에 네이티브 설치**(새 아이콘), 이미 설치(standalone)면 아이콘이 OS 캐시라 **삭제 후 재추가 수동 안내**(iOS는 공유→홈 화면 추가). `localStorage.nb_icon_seen`로 1회 제어.

## 컨벤션
- 커밋 메시지: 한국어, 의미 단위. 배포는 `ship` 스킬 사용.
- 브랜치(하이브리드): 작은 수정은 `main` 직접, 기능 단위·실험·배포 붙은 작업은 `feat/xxx` 브랜치 → PR 머지.
- 데이터 모델 / 폴더 구조가 바뀌면 이 문서를 갱신한다.
