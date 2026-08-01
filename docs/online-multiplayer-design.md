# 온라인 대전 — 기획과 아키텍처

숫자 야구를 **친구와 실시간으로** 겨루게 하는 기능. 한 기기에서 번갈아 하는 패스앤플레이
(스피드·턴제)와 달리, 온라인 대전은 **서로 다른 기기에서 방 코드로 만나** 서버가 심판을 본다.

---

## 1. 목표와 제약

**하고 싶던 것**
- 방 코드 하나로 1:1 매칭 → 서로 상대가 맞힐 숫자를 몰래 정하고 → 번갈아 추측 → 승부.
- 정답을 **클라이언트가 들고 있으면 안 된다.** 브라우저 콘솔·네트워크 탭만 봐도 상대 숫자가
  보이면 게임이 성립하지 않는다. → **서버 권위(authoritative)** 구조가 전제.
- 모바일 웹에서 **끊겨도 다시 붙을 수 있어야** 한다(백그라운드 전환·지하철·엘리베이터).

**제약**
- 프론트는 이미 Vercel(HTTPS)에 배포돼 있다 → WebSocket도 **`wss://` 필수**(혼합 콘텐츠 차단).
- 서버 비용을 안 들이고 싶다 → Oracle Cloud 항상 무료(Always Free) VM 활용.
- 게임 규칙 로직(`logic.ts`)은 이미 프론트에 있다 → 서버와 **동일 로직을 공유/복제**해야 판정이 일치.

## 2. 왜 이 스택인가

| 선택 | 이유 | 대안과 트레이드오프 |
|------|------|--------------------|
| **Node + Socket.IO + TypeScript** | 프론트와 같은 언어(TS)라 타입·로직 공유가 쉽다. Socket.IO는 재연결·폴백·방(room) 기능을 기본 제공 | 순수 `ws`는 가볍지만 재연결/폴백을 직접 짜야 함. WebRTC(P2P)는 서버 권위가 어려워 탈락 |
| **서버 권위** | 정답 보관·판정·턴 관리를 서버가 독점 → 클라 조작 불가 | 클라 권위는 구현이 쉽지만 치팅에 무방비 |
| **방 코드(4자리)** | 로그인·계정 없이 즉석 매칭. URL 공유보다 입력이 짧다 | 자동 매치메이킹은 사용자 풀이 필요해 오버스펙 |
| **메모리 저장(DB 없음)** | 판이 짧고 영속성이 필요 없다. 방은 게임이 끝나면 사라짐 | DB는 재시작 복원엔 좋지만 이 규모엔 과함 → 대신 **재접속 토큰**으로 세션만 살림 |

## 3. 구성 요소

```
[브라우저 A]  ──wss──┐
                     ├──►  [Caddy : 자동 TLS 리버스 프록시]  ──►  [Node/Socket.IO :3001]
[브라우저 B]  ──wss──┘            (Let's Encrypt)                    (정답 보관·판정·턴)
     ▲                                                                    │
     └────────────────── 이벤트(reveal/turn/over…) ◄──────────────────────┘
```

**프론트**
- `src/net/socket.ts` — 단일 소켓 인스턴스. `autoConnect: false`(온라인 화면 진입 시 connect),
  `transports: ['websocket','polling']`(불안정 망 폴백), `reconnection: true`, `reconnectionAttempts: Infinity`.
  주소는 `VITE_SERVER_URL`(개발 `http://localhost:3001`, 배포 `wss://<HOST>`).
- `src/net/protocol.ts` — 클라↔서버 **이벤트 계약(타입)**. `server/src/types.ts`와 **똑같이 유지**한다.
- `src/versus/OnlineDuel.tsx` — 온라인 대전 화면 전체. 로컬 상태는 **서버 이벤트로만** 전이한다.

**서버(`server/`)**
- `src/index.ts` — Socket.IO 서버. 이벤트 핸들러, 발표 텀·유예 타이머 같은 시간 로직.
- `src/rooms.ts` — 방/플레이어 상태(메모리 `Map`), 코드·토큰 생성.
- `src/logic.ts` — 판정 로직. **프론트 `src/game/logic.ts`와 복제**(함께 수정해야 판정 일치).
- `src/types.ts` — 이벤트 계약. `protocol.ts`와 동기화.

## 4. 이벤트 프로토콜

계약은 `protocol.ts`(프론트) = `types.ts`(서버). ack가 있는 건 요청-응답형.

**클라이언트 → 서버**

| 이벤트 | 페이로드 | 의미 |
|--------|----------|------|
| `create` | `{nick, digits}` → ack `{code, index:0, digits, token}` | 방 생성(내가 선공=index 0) |
| `join` | `{nick, code}` → ack `{ok, index:1, digits, opponentNick, token}` | 코드로 입장(후공=index 1) |
| `setSecret` | `{secret}` → ack `{ok}` | 상대가 맞힐 내 숫자 확정 |
| `guess` | `{guess}` → ack `{ok}` | 내 차례에 상대 숫자 추측 |
| `input` | `{value}` | 입력 중간 상태(실시간 미리보기 중계용) |
| `rematch` | — | 재대결 신청 |
| `leave` | ack `()` | **의도적 나가기**(백그라운드 이탈과 구분) |
| `rejoin` | `{code, index, token}` → ack `{ok, resume}` | 재접속 — 저장한 자리로 다시 합류 |

**서버 → 클라이언트**

| 이벤트 | 의미 |
|--------|------|
| `opponentJoined` | 상대 입장 |
| `phase` | `secret` 단계로(둘 다 입장) |
| `secretProgress` | 비밀 설정 진행(`ready: boolean[]`) |
| `start` | 플레이 시작(`turn`, `digits`) |
| `reveal` | 추측 결과 발표(`by, guess, judgement, solved, attempts`) — 잠깐 표시 후 turn/over |
| `turn` | 턴 넘김 |
| `opponentInput` | 상대 실시간 입력 미리보기 |
| `over` | 종료(`outcome, secrets, attempts`) |
| `rematchRequested` | 상대가 재대결 신청 |
| `opponentDisconnected` / `opponentReconnected` | 상대 끊김/복귀(유예 중) |
| `opponentLeft` | 상대가 방을 떠남(게임 종료) |
| `errorMsg` | 오류 메시지 |

## 5. 상태 머신

**방(서버) `Phase`**: `waiting`(상대 대기) → `secret`(둘 다 숫자 정하기) → `playing`(번갈아 추측) → `over`.

**화면(프론트) `Phase`**: `menu` → `lobby`(코드 공유·대기) → `secret` → `playing` → `over`.
프론트는 서버 `waiting`을 `lobby`로 매핑한다.

```
create ─► lobby ──opponentJoined──► secret ──둘다 setSecret──► playing ──guess/reveal/turn 반복──► over
join   ─────────────────────────────┘                                                              │
                                        rematch(둘다) ◄──────────────────────────────────────────────┘
```

## 6. 공정성 규칙 (선공 보정)

턴제라 **선공(P1)이 구조적으로 유리**하다. 그대로 두면 P1이 먼저 맞히는 순간 끝나 P2는 기회를 못 얻는다.
그래서:

- P1이 맞혀도 즉시 끝내지 않고, **같은 라운드에서 P2에게 마지막 한 번**을 준다.
- 둘 다 맞히면 **무승부**. P1만 맞히면 P1 승, P2만 맞히면 P2 승.
- 서버 `advanceAfterReveal`가 이 순서를 강제한다: 추측자가 P1(index 0)이면 항상 P2 턴으로,
  P2(index 1)이면 그때 승패/무승부를 판정한다.

프론트에선 이 상황을 **"역전 찬스! 맞히면 무승부"**(내가 후공이고 선공이 이미 맞힘) /
**"상대의 마지막 기회…"**(내가 선공으로 맞힌 뒤)로 연출한다.

## 7. 발표 텀(reveal pacing)

추측 즉시 턴을 넘기면 정신없다. 그래서 서버는 `guess` 처리 후:

1. `pending = true`로 **입력을 잠그고** 양쪽에 `reveal`을 보낸다.
2. `REVEAL_MS`(1900ms) 뒤 `advanceAfterReveal`가 `turn` 또는 `over`를 보낸다.
3. 그 사이 특이 이벤트(쓰리아웃/올볼/한 끗 차이/정답)는 강조 멘트로 리액션.

추측한 사람의 숫자는 **상대 비밀과 무관**하므로 공개해도 공정성이 깨지지 않는다(양쪽에 같이 보여줌).

## 8. 연출(왜 넣었나)

즉석 대전은 **상대가 사람이라는 감각**이 재미의 핵심이라, "지금 상대가 뭔가 하고 있다"를 계속 보여줬다.

- **상대 실시간 입력 미리보기** — `input`/`opponentInput` 중계로 상대가 채워가는 숫자를 흐릿하게.
- **상대 대기 랜덤 멘트** — "상대가 사인을 보는 중…" 같은 야구톤 문구 순환.
- **시작 발표** — "모두 숫자를 골랐어요! ○○ 먼저 시작!".
- **내 숫자 peek** — 내가 정한 숫자를 기본 블러 처리, 눌러서 토글 확인/숨김(어깨너머 방지).
- **재대결 신청 알림 / 승·패 강조 결과 화면**.

플레이 화면 레이아웃은 **자리 고정**이 원칙: 상단 상태 슬롯(`.play-stage` — 발표/개시/상대입력·대기만)
→ **고정 키패드**(내 차례엔 입력, 상대 차례엔 메모 전용) → **기록 탭**(내/상대). 턴이 바뀌어도 요소가
안 튀게 했다.

## 9. 재접속 설계 (모바일 생존)

모바일 웹의 최대 적은 **백그라운드 전환**이다. 다른 앱으로 갔다 오면 소켓이 끊긴다. 그래서:

- **유예(grace)** — 끊겨도 서버가 방을 **바로 안 지운다**. `GRACE_MS`(90s) 동안 재접속을 기다린다.
- **토큰 재합류(rejoin)** — 방마다 플레이어에게 `token`을 발급. 재연결 시 `{code, index, token}`으로
  `rejoin` → 서버가 소켓을 원래 자리에 다시 연결하고 `resume`(현재 상태)을 돌려준다.
- **세션 영속(sessionStorage)** — 클라는 세션(코드·자리·토큰)을 `nb_online_session`에 저장.
  탭이 리로드/복귀해도 마운트 시 복원해 **자동 rejoin**(그동안 "방에 다시 연결하는 중" 화면, 9s 타임아웃 폴백).
- **유예 만료 정책** — 만료돼도 **상대가 아직 접속 중이면 방을 유지**한다(내가 자리를 지키는 한 계속 기다림).
  둘 다 없을 때만 방을 정리. 즉 **연결 자체가 활동 신호** — 별도 앱 레벨 핑이 필요 없다.
- **의도적 나가기(`leave`)** — 나가기 버튼은 백그라운드 이탈과 구분해 서버에 즉시 알린다 →
  상대에게 바로 `opponentLeft`, 방 정리. 애매한 "상대 나감"을 줄인다.

Socket.IO는 폴링 폴백 + 관대한 ping(`pingInterval` 25s, `pingTimeout` 40s)으로 잠깐의 멈춤엔 안 끊긴다.

## 10. 배포 구성

- **서버**: Oracle Cloud Always Free VM(Ubuntu). pm2로 상주(`nb-server`), 2GB 스왑.
- **TLS**: 프론트가 HTTPS라 `wss://` 필수 → **Caddy**가 자동 Let's Encrypt 인증서 + 리버스 프록시
  (`reverse_proxy localhost:3001`). 도메인이 없으면 `<공인IP>.sslip.io` 사용.
- **CORS**: `CORS_ORIGIN=https://number-baseball-chi.vercel.app`(배포 프론트만 허용).
- **프론트 연결**: Vercel env `VITE_SERVER_URL = wss://<HOST>` 설정 후 재배포.
- **서버 코드 바꾸면 재배포 필요**: `git pull && pnpm -C server build && pm2 restart nb-server`.

절차 상세는 [`server/README.md`](../server/README.md).

## 11. 규칙 로직 이중화 주의

`logic.ts`는 프론트(`src/game/logic.ts`)와 서버(`server/src/logic.ts`) **양쪽에 복제**돼 있다.
판정이 어긋나면 클라 표시와 서버 승패가 달라지므로 **반드시 함께 수정**한다. `protocol.ts`↔`types.ts`도 동일.
(공유 패키지로 뽑는 게 정석이지만, 배포 파이프라인을 단순하게 두려고 복제를 택했다.)
