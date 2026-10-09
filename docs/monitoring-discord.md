# 서버·DB 접속 감시 → 디스코드 알림

게임 서버나 팬 랭킹 DB에 접속이 안 되면 디스코드로 바로 알림이 온다(`monitor/index.mjs`, 의존성 없음).

## 무엇을 보나
| 검사 | 방법 | 실패 사유 예 |
|---|---|---|
| 🖥️ 게임 서버 | `GET /health` = 200 `ok` **+** Socket.IO 폴링 핸드셰이크(`/socket.io/?EIO=4&transport=polling`)가 `sid`를 돌려줌 — 실제 접속 경로까지 확인 | `fetch failed (ECONNREFUSED)`, `응답 없음(8초 타임아웃)`, `HTTP 502` |
| 🗄️ DB | `GET /health/db`(서버가 `SELECT 1`, 3초 타임아웃) — **서버가 살아 있을 때만** 검사(서버가 죽으면 중복 알림 안 냄) | `init_failed`(시작 때 연결 실패 → **DB 살린 뒤 서버 재시작 필요**), `query_failed`(지금 응답 없음), `disabled`(`DATABASE_URL` 없음) |

- `FAIL_THRESHOLD`(기본 2)번 **연속** 실패해야 🔴 알림(순간 끊김 무시) → 30초 간격이면 최대 ~1분 안에 온다.
- 계속 죽어 있으면 `REMIND_MIN`(기본 30)분마다 "아직 다운" 재알림(멘션 없음), 살아나면 🟢 **복구 + 다운 시간**.
- `/health`는 그대로 DB와 무관하게 200(컨테이너 헬스체크용 — DB가 죽어도 대전은 돼야 하니 재시작시키면 안 됨).

## 1. 디스코드 웹훅 만들기
1. 알림 받을 서버에 **나만 보는 채널**(예: `#서버-알림`) 생성.
2. 채널 ⚙ **채널 편집 → 연동 → 웹후크 → 새 웹후크** → **웹후크 URL 복사**.
3. (선택) 폰 푸시로 받으려면 멘션: 디스코드 **설정 → 고급 → 개발자 모드** 켜고 내 프로필 우클릭 **사용자 ID 복사** → `DISCORD_MENTION=<@그ID>`.
   채널 알림 설정을 '@멘션만'으로 해 두면 🔴·🟢만 울리고 재알림은 조용하다.

> 웹훅 URL은 비밀번호 취급(아는 사람은 누구나 그 채널에 글을 쓸 수 있음). 레포에 커밋하지 말고 env로만.

## 2. Dokploy에 띄우기 (게임 서버와 별개 Application)
1. 같은 프로젝트에서 **Create Service → Application**(예: `nb-monitor`), 소스는 게임 서버와 같은 레포·`main`.
2. **Build**: Build Type `Dockerfile` · Build Path `/` · **Docker File `Dockerfile.monitor`** · Watch Paths `monitor/**`, `Dockerfile.monitor`.
3. **Environment**: `monitor/.env.example` 참고 — 필수는 `DISCORD_WEBHOOK_URL` 하나.
4. **도메인·포트 없음**(밖으로 여는 포트가 없다). Deploy → 디스코드에 "👀 모니터 시작"이 오면 정상.

### ⚠️ 한계 — 같은 호스트
모니터가 게임 서버와 **같은 Dokploy 호스트**에 있으면 호스트가 통째로 죽었을 때(정전·Docker 장애) 모니터도 같이 죽어 알림이 안 온다.
이걸 잡으려면 둘 중 하나:
- 다른 곳에서 돌린다: 아무 머신에서 `DISCORD_WEBHOOK_URL=... node monitor/index.mjs`(Node 22+).
- 바깥 무료 업타임 서비스(UptimeRobot 등, 디스코드 웹훅 지원)에 `https://homerun.techeer.cloud-yaho.cloud/health`를 하나 더 걸어 둔다 — 호스트 장애 대비 2차 안전망.

## 3. 로컬에서 시험
```bash
# 서버(DB 없이) — /health/db 는 503 {"db":"disabled"}
cd server && PORT=3101 npx tsx src/index.ts
# 모니터 — 1초 간격으로, 서버를 껐다 켜 보면 🔴/🟢가 온다
DISCORD_WEBHOOK_URL=<웹훅> TARGET_URL=http://localhost:3101 INTERVAL_S=1 node monitor/index.mjs
```

## 환경변수
| 변수 | 기본값 | 설명 |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | (필수) | 디스코드 웹훅 URL |
| `TARGET_URL` | `https://homerun.techeer.cloud-yaho.cloud` | 감시할 게임 서버 |
| `INTERVAL_S` | `30` | 검사 간격(초) |
| `FAIL_THRESHOLD` | `2` | 연속 몇 번 실패해야 알릴지 |
| `TIMEOUT_MS` | `8000` | 요청 하나 타임아웃 |
| `REMIND_MIN` | `30` | 다운 지속 시 재알림 간격(분, `0`=안 함) |
| `DISCORD_MENTION` | (없음) | 🔴·🟢 알림에 붙일 멘션(예 `<@123…>`) |
| `MONITOR_NAME` | `홈런 서버 모니터` | 웹훅 표시 이름 |
| `NOTIFY_ON_START` | `1` | 모니터 시작 알림(`0`=끔) — 모니터 재배포 확인용 |
