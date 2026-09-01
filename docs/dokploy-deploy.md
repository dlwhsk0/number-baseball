# 온라인 서버 배포 — Dokploy 마이그레이션 가이드

숫자 야구 온라인 서버(`server/`, Node + Socket.IO)를 기존 **오라클 VM(Caddy + pm2)** 에서
**Dokploy**(셀프호스팅 PaaS, Docker + Traefik)로 옮기는 절차. GitHub 레포 연동 + Dockerfile 빌드 + 새 도메인.

> 채워 넣을 값(이 문서의 플레이스홀더):
> - `<SERVER_IP>` — 새 VPS 공인 IP
> - `<SERVER_DOMAIN>` — 서버용 새 도메인 (예: `api.example.com`). 프론트가 `wss://<SERVER_DOMAIN>`로 접속.

---

## 0. 무엇이 바뀌나

| 기존(오라클 VM) | Dokploy |
|---|---|
| Caddy (리버스프록시 + TLS) | **Traefik** (Dokploy 내장, Let's Encrypt 자동) |
| pm2 (프로세스 관리) | **Docker 컨테이너** (Dokploy가 관리·재시작) |
| `scripts/redeploy-server.sh` (SSH pull+build+restart) | **git push → 자동 재배포**(webhook) |
| 수동 `.env` / pm2 env | Dokploy UI의 **Environment** 탭 |
| 도메인 `b-ball.duckdns.org` | **새 도메인 `<SERVER_DOMAIN>`** |

### ⚠️ 반드시 지킬 제약
- **상태가 메모리에만 있다**(방·플레이어를 DB 없이 in-memory 보관). 따라서:
  - **인스턴스는 딱 1개(replicas = 1)**. 여러 개 띄우면 방이 갈라져서 대전이 깨진다. (수평 확장하려면 Redis 어댑터가 필요 — 지금은 범위 밖.)
  - 재배포/재시작 시 **진행 중인 방은 사라진다**(무중단 아님). 한산한 시간에 배포 권장.
- 데이터 이전 작업은 **없음**(영속 데이터가 없으므로).

---

## 1. 사전 준비
- **VPS**: Ubuntu 22.04/24.04, RAM 2–4GB 권장, root(또는 sudo) 접근. 준비됨(`<SERVER_IP>`).
- **방화벽/보안그룹 오픈**: `80`, `443`(웹/TLS), `22`(SSH), `3000`(Dokploy UI — 가능하면 내 IP로 제한).
- **DNS**: `<SERVER_DOMAIN>`의 A 레코드를 `<SERVER_IP>`로. (인증서 발급 전에 먼저 전파돼 있어야 함.)
- 레포 **루트에 `Dockerfile`** 있음(루트 컨텍스트에서 `server/` 빌드). 로컬 `docker build`로 검증 완료(`/health` 200).

---

## 2. Dokploy 설치
VPS에 SSH 접속 후(root):
```bash
curl -sSL https://dokploy.com/install.sh | sh
```
- Docker + Dokploy + Traefik을 자동 설치한다.
- 완료되면 UI가 `http://<SERVER_IP>:3000` 에 뜬다.

브라우저로 `http://<SERVER_IP>:3000` 접속 → **관리자 계정 생성**(이메일/비번). 최초 1회.

---

## 2-B. 이미 있는 공유 Dokploy에 얹는 경우 (설치 스킵)
회사/팀/지인의 **온프레미스 서버에 Dokploy·Traefik·도메인이 이미 깔려 있다면 위 1·2단계(서버 준비·설치)는 건너뛴다.**
너는 그 위에 **네 앱만** 얹으면 된다. IP도 대부분 몰라도 됨(접속은 대시보드 URL, 라우팅은 Traefik이 호스트명으로 처리).

**서버 관리자에게 받을 것 3가지:**
1. **Dokploy 대시보드 URL + 내 계정**(초대). 접속은 서버 IP가 아니라 이 대시보드로.
2. **서브도메인 방식**:
   - 와일드카드 DNS(`*.<공유도메인>` → 서버)가 있으면 → 아무 서브도메인(예: `homerunjomchija.<공유도메인>`)만 정하면 Traefik+Let's Encrypt가 자동 발급·라우팅.
   - 없으면 → 관리자에게 `<내 서브도메인> A레코드 → 서버 IP` 추가 요청.
3. (선택) 리소스 제한/사용 정책.

**공유 서버 에티켓:**
- **네 전용 Project**를 새로 만들고, 남의 앱·Traefik 전역 설정은 건드리지 않는다.
- 서브도메인은 안 겹치게 고유하게. (컨테이너 내부 포트 `3001`은 격리돼 남과 안 겹침 — Traefik은 **호스트명**으로 라우팅.)
- 이 경우 `<SERVER_DOMAIN>`은 **네 서브도메인**(`homerunjomchija.<공유도메인>`)이 된다.

→ 이후는 **3단계부터 그대로**. 인증서·리버스프록시 인프라는 이미 있으니 **도메인만 추가하면 Traefik이 붙여준다.**

---

## 3. 프로젝트 & 애플리케이션 생성
1. Dokploy 대시보드 → **Create Project**(예: `number-baseball`).
2. 프로젝트 안에서 **Create Service → Application**(예: `nb-server`).

### GitHub 연동 (레포가 public이라 제일 쉬움)
레포 `dlwhsk0/number-baseball`는 **공개**라 인증 없이 클론된다. 두 갈래 중 택1:

**A) 공개 Git URL — 가장 단순 (권장, 특히 공유 Dokploy)**
1. Application → **Source/Provider** 탭 → **Git**(Custom/Generic) 선택.
2. **Repository URL**: `https://github.com/dlwhsk0/number-baseball.git`  ·  **Branch**: `main`  (공개라 키·토큰 불필요)
3. 자동배포 원하면 **Webhook 수동 등록**: Dokploy가 주는 Webhook URL을 GitHub 레포
   **Settings → Webhooks → Add webhook** (Content type `application/json`, `push` 이벤트)에 붙인다.
   안 걸면 Dokploy 대시보드에서 **수동 Deploy** 버튼으로 갱신.

**B) GitHub App — 자동배포 내장 (Settings 접근 권한 있을 때)**
1. Dokploy **Settings → Git Providers → GitHub → Create/Install GitHub App** → GitHub로 리다이렉트되어
   앱 생성·설치하며 `number-baseball` 레포 접근 허용.
2. Application → **Source → GitHub** → **Repository** `dlwhsk0/number-baseball`, **Branch** `main`.
3. **Auto Deploy** 켜면 push마다 자동 재배포(webhook 자동 등록).
   - *공유 Dokploy라 Settings가 막혀 있으면* 관리자에게 GitHub App 연결을 요청하거나 **A안**을 쓴다.

> private 레포였다면: Dokploy가 만든 **SSH 공개키를 GitHub 레포 Settings → Deploy keys(읽기전용)** 에 등록하는 방식이 필요. 지금은 public이라 불필요.

---

## 4. 빌드 설정 (루트 Dockerfile — Dokploy 기본값 그대로)
**Dockerfile을 리포 루트에 두었다.** 루트 컨텍스트에서 `server/` 만 빌드하도록 작성돼 있어
**Dokploy 기본값 그대로** 동작한다. **Build** 탭:
- **Build Type**: `Dockerfile`
- **Build Path**: `/`  (기본값 그대로)
- **Docker File**: `Dockerfile`  (기본값 그대로 — 비워도 됨)
- **Watch Paths**(자동배포 필터, 선택): `server/**`, `Dockerfile`

> 왜 루트에? Dokploy가 `server/Dockerfile` 하위 경로를 못 찾는 경우(`open Dockerfile: no such file`)가 잦아서,
> **루트 Dockerfile + 기본 설정**이 가장 확실하다. (루트 Dockerfile이 `COPY server/...` 로 server 폴더만 가져옴.)

---

## 5. 환경변수 (Environment 탭)
**필수는 이 둘뿐**, 나머지는 전부 기본값이 있어 생략 가능하다.
```
# --- 필수 ---
CORS_ORIGIN=https://number-baseball-chi.vercel.app,https://homerun-bb.vercel.app
PORT=3001

# --- 선택: 게임 튜닝(기본값 있음) ---
REVEAL_MS=1900           # 결과 발표 텀(ms)
GRACE_MS=90000           # 끊김 유예(ms) — 모바일 백그라운드 대비
SPEED_LIMIT_3_MS=300000  # 스피드 3자리 제한시간(5분)
SPEED_LIMIT_4_MS=420000  # 스피드 4자리 제한시간(7분)
SCORE_SEC_PER_POINT=20   # 스피드 점수: 몇 초를 1점으로 환산할지

# --- 선택: 관측(기본값 있음) ---
LOG_LEVEL=info           # pino 로그 레벨 (trace/debug/info/warn/error)
METRICS_PORT=9091        # 메트릭 전용 포트(게임 포트와 분리 → 도메인에 노출 안 됨)
METRICS_TOKEN=           # 설정 시 /metrics에 Bearer 또는 ?token= 요구
```
- `CORS_ORIGIN`은 **프론트(브라우저) 오리진** — 서버 도메인이 아니라 **Vercel 주소** 그대로. 여러 개면 **쉼표로, 공백 없이**.
  비워두면 전체 허용(`*`)이라 개발용으로만.
- `PORT=3001`은 컨테이너 내부 포트(도메인 매핑에서 이 포트를 가리킴).
- `METRICS_PORT`(9091)는 **Domains에 매핑하지 말 것** — 매핑 안 해야 비공개로 남는다.

---

## 6. 도메인 + HTTPS (Traefik)
Application → **Domains** → **Add Domain**:
- **Host**: `<SERVER_DOMAIN>`
- **Container Port**: `3001`
- **HTTPS**: 켬, **Certificate Provider**: `Let's Encrypt`
- **Path**: `/`

Traefik이 **WebSocket 업그레이드를 자동 프록시**한다(별도 설정 불필요). Socket.IO(wss)도 그대로 동작.

---

## 7. 배포 & 검증
1. **Deploy** 클릭 → **Logs/Deployments** 탭에서 빌드·기동 로그 확인.
   - 성공 시 로그에 `[number-baseball] online server listening on :3001`.
2. 헬스체크:
   ```bash
   curl https://<SERVER_DOMAIN>/health     # → ok
   ```
3. 실제 프로토콜 스모크(로컬에서 새 서버 대상으로):
   ```bash
   URL=https://<SERVER_DOMAIN> node server/test/e2e-smoke.mjs
   URL=https://<SERVER_DOMAIN> node server/test/speed-rules-smoke.mjs
   URL=https://<SERVER_DOMAIN> node server/test/speed-over-smoke.mjs
   URL=https://<SERVER_DOMAIN> node server/test/host-lifecycle-smoke.mjs
   ```
   전부 통과하면 서버 이전 성공.

**Replicas**는 **1**인지 확인(Advanced/General). 절대 늘리지 말 것(위 제약 참고).

---

## 8. 자동 재배포 (webhook)
GitHub 연동 시 Dokploy가 webhook을 건다 → `main`에 push하면 **자동 재빌드·재배포**.
- 이제 **`scripts/redeploy-server.sh`는 불필요**(구 VM 전용). 서버 코드 고치고 push만 하면 됨.
- Auto Deploy 옵션이 꺼져 있으면 Application 설정에서 켜기.

---

## 8-B. 무중단 배포 (Swarm `start-first`)

Dokploy는 내부적으로 **Docker Swarm**을 쓴다. 기본 업데이트 순서는 `stop-first`(옛 컨테이너를 먼저
내리고 새 컨테이너를 올림)라 **배포마다 수십 초 502**가 뜬다. 이를 `start-first`로 바꾸면
**새 컨테이너가 health OK가 된 뒤에 옛 컨테이너를 내리므로 502 공백이 사라진다.**

### ⚠️ 무중단의 범위 — 가용성만이다
방 상태(`server/src/rooms.ts`)가 **프로세스 메모리에만** 있어서:
- **얻는 것**: HTTP/WS 엔드포인트가 배포 중에도 계속 응답한다. 새로 들어오는 사람은 끊김을 못 느낀다.
- **못 얻는 것**: **배포 순간 진행 중이던 대전은 어차피 끊긴다.** 새 컨테이너엔 그 방이 없다.
  클라가 `rejoin`을 시도해도 서버에 방이 없으므로 복구되지 않는다.
- **겹침 구간 주의**: `start-first`는 잠깐(수 초) 컨테이너가 **2개** 뜬다. 그동안 Traefik이 새 연결을
  둘 중 아무 쪽에나 보내므로, **같은 방의 두 사람이 서로 다른 컨테이너에 붙을 수 있다**(방 못 찾음).
  → **사람이 없을 때 배포**하는 게 여전히 안전하다. 진짜로 대전까지 보존하려면 아래 TODO 참고.

### 설정 (Application → Advanced → Swarm Settings)
JSON 필드에 넣는다. **Docker API라 시간 단위가 전부 나노초**다(5초 = `5000000000`).

**Update Config**
```json
{
  "parallelism": 1,
  "order": "start-first",
  "failureAction": "rollback",
  "delay": 5000000000,
  "monitor": 15000000000,
  "maxFailureRatio": 0
}
```
- `order: start-first` — 이게 핵심.
- `failureAction: rollback` — 새 컨테이너가 health를 못 맞추면 **자동으로 이전 버전 복귀**.
- `monitor: 15s` — 새 태스크를 이 시간 동안 지켜보고 실패 판정. Dockerfile `HEALTHCHECK`의
  `--start-period=8s`보다 넉넉해야 한다.

**Rollback Config**
```json
{
  "parallelism": 1,
  "order": "start-first",
  "failureAction": "pause",
  "delay": 5000000000
}
```

**Restart Policy**
```json
{
  "condition": "any",
  "delay": 5000000000,
  "maxAttempts": 5,
  "window": 60000000000
}
```

> Dokploy 버전에 따라 키 표기가 camelCase(`failureAction`)일 수도 PascalCase(`FailureAction`)일 수도 있다.
> **입력칸의 placeholder에 보이는 표기를 따른다.**

### 같이 확인할 것
- **Replicas는 1 그대로.** `start-first`는 배포 중에만 잠깐 2개가 되는 것이고, 정상 상태는 1개여야 한다.
  (상시 2개면 방이 갈려서 게임이 깨진다.)
- **호스트 포트를 publish하지 말 것.** Traefik이 오버레이 네트워크에서 서비스명으로 라우팅하므로
  `3001:3001` 같은 호스트 포트 매핑은 불필요하고, `mode: host`로 잡혀 있으면 겹침 구간에 포트 충돌로
  새 태스크가 못 뜬다. Domains 탭의 **Container Port `3001`** 만 있으면 된다.
- **헬스체크는 이미 이미지에 있다** — 루트 `Dockerfile`의 `HEALTHCHECK`가 `/health`를 찌른다.
  Swarm이 이걸 그대로 쓰므로 Dokploy Health Check 칸은 비워도 된다.

---

## 8-C. TODO — 진행 중인 대전까지 보존하기

위 `start-first`로는 **가용성만** 무중단이다. 배포·재시작 중에도 **진행 중인 방을 살리려면**
방 상태를 프로세스 밖으로 빼야 한다. 우선순위 순으로 적어둔다.

### 1순위 — 방 상태 외부화 (Redis)
현재 `server/src/rooms.ts`의 방 맵이 프로세스 메모리다. 이걸 Redis로 옮긴다.
- **범위**: 방(코드·모드·자릿수)·플레이어(닉·index·토큰·`gone`)·비밀 숫자·턴/히스토리·스피드 진행도.
- **주의**: 정답(`secret`/`speedSecret`)이 Redis에 들어가므로 **서버만 접근 가능한 내부 네트워크**에 두고
  절대 외부 노출하지 않는다(정답 유출 = 게임 붕괴).
- **타이머**: `REVEAL_MS` 지연, `GRACE_MS` 유예, 스피드 제한시간은 현재 `setTimeout`이라 프로세스와 함께 죽는다.
  **만료 시각(timestamp)을 상태에 저장**하고 복구 시 남은 시간으로 다시 걸어야 한다. (이게 실제로 제일 손이 많이 간다.)
- Dokploy에 Redis 서비스 추가 + `REDIS_URL` env.

### 2순위 — 다중 인스턴스 대응 (Socket.IO 어댑터)
1순위가 끝나면 `replicas>1`이 가능해진다. 단 Socket.IO 브로드캐스트가 인스턴스 간에 퍼지려면
**`@socket.io/redis-adapter`** 가 필요하다. 이게 있어야 `start-first` 겹침 구간에 방이 갈리는 문제도 사라진다.

### 3순위 — 우아한 종료(graceful drain)
`SIGTERM`을 받으면 (1) 새 연결 거부 (2) 접속자에게 "곧 재시작" 알림 (3) 상태 flush 후 종료.
Swarm의 `stop-grace-period`를 늘려 그 시간을 확보한다.

### 안 하기로 한 것
- **스티키 세션(Traefik cookie)**: Socket.IO의 polling→WS 업그레이드에 부분적으로는 도움이 되지만,
  방을 **같은 인스턴스로 묶어주지는 못한다**(두 플레이어는 서로 다른 세션이다). 근본 해결이 아니라 제외.

> 이 작업 전까지는 **사람이 없을 때 배포**가 사실상의 운영 규칙이다.

---

## 9. 프론트 전환 (Vercel)
서버가 새 도메인으로 확정되면 프론트가 새 서버를 바라보게:
1. Vercel 프로젝트 → **Settings → Environment Variables**:
   - `VITE_SERVER_URL = wss://<SERVER_DOMAIN>`
2. **Redeploy**(프론트 재배포 — 빌드시 주입되는 값이라 재배포 필요).
3. 배포 후 실제 앱에서 **온라인 대결(스피드/주고받기)** 로 접속·플레이 확인.

> 참고: 도메인을 바꾸므로 이 단계가 필수. (도메인을 유지했다면 생략 가능했음.)

---

## 10. 컷오버 & 롤백
- **구 오라클 VM은 검증 끝날 때까지 켜둔다.** 문제가 생기면 Vercel의 `VITE_SERVER_URL`을 옛 주소(`wss://b-ball.duckdns.org`)로 되돌리고 재배포하면 즉시 롤백.
- Dokploy는 배포 이력을 보관 → 이전 배포로 **Rollback** 가능.
- 새 서버가 안정적으로 확인되면 구 VM 폐기.

### 컷오버 후 정리(레포) — ✅ 완료
- `CLAUDE.md`·`server/README.md`·`server/.env.example` 서버 섹션을 Dokploy·새 도메인으로 갱신함.
- `scripts/redeploy-server.sh`, `server/Caddyfile.example` **삭제함**(이력은 태그 `v1.0.0-pre-dokploy`).
- 로컬 `scripts/deploy.env`(gitignore, 옛 SSH 정보)는 각자 로컬에서 삭제.

---

## 환경변수 레퍼런스
| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3001` | 컨테이너 리슨 포트(도메인 매핑 대상) |
| `CORS_ORIGIN` | `*` | 허용 브라우저 오리진(쉼표 다중). 배포 시 프론트 도메인 지정 |
| `REVEAL_MS` | `1900` | 추측 후 결과 발표 텀(ms) |
| `GRACE_MS` | `90000` | 끊김 유예(ms) — 재접속 복구 대기 |
| `SPEED_LIMIT_3_MS` | `300000` | 스피드 3자리 제한(5분) |
| `SPEED_LIMIT_4_MS` | `420000` | 스피드 4자리 제한(7분) |

---

## 트러블슈팅
- **빌드 실패 `ERR_PNPM_IGNORED_BUILDS`**: 이미 처리됨 — `server/package.json`에 `pnpm.ignoredBuiltDependencies:["esbuild"]` + `packageManager` 고정. pnpm 10 대응.
- **WebSocket 400 / 연결 안 됨**: Traefik은 기본으로 ws 업그레이드 지원. Domain의 Container Port가 `3001`인지, `CORS_ORIGIN`에 프론트 오리진이 있는지 확인.
- **CORS 에러**: `CORS_ORIGIN`이 실제 프론트 주소와 정확히 일치해야 함(스킴 포함, 끝 슬래시 없이).
- **인증서 발급 실패**: DNS A 레코드가 `<SERVER_IP>`로 전파됐는지, 80/443 오픈됐는지 확인 후 재배포.
- **재시작마다 방 사라짐**: 정상(메모리 상태). 배포는 한산한 시간에.
- **로컬 검증**: `cd server && docker build -t nb .` → `docker run -p 3009:3001 -e CORS_ORIGIN=... nb` → `curl localhost:3009/health` → `ok`.
