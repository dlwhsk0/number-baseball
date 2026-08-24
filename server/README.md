# 숫자 야구 · 온라인 대결 서버

턴제 1:1 + 스피드(2~6명) 대결용 Socket.IO 서버. **방 코드**로 입장하고, **서버가 정답을 쥐고 판정**한다(상대가 서로의 비밀 숫자를 볼 수 없음). 상태는 메모리에만 있다(영속화 없음).

## 스택
- Node + Socket.IO + TypeScript. 게임 규칙은 `src/logic.ts`(프론트 `src/game/logic.ts`와 동일한 순수 로직).

## 개발
```bash
pnpm install
pnpm dev          # tsx watch, :3001
pnpm typecheck
node test/e2e.mjs # 서버를 띄운 상태에서 2인 e2e 스모크
```

## 프로덕션
```bash
pnpm build        # tsc → dist
pnpm start        # node dist/index.js
```

## 환경 변수
- `PORT` — 리슨 포트(기본 `3001`).
- `CORS_ORIGIN` — 허용 오리진. 쉼표로 여러 개. 배포 시 프론트 도메인만 지정(예: `https://number-baseball-chi.vercel.app`). 미지정 시 전체 허용(개발용).
- 그 외: `REVEAL_MS`, `GRACE_MS`, `SPEED_LIMIT_3_MS`, `SPEED_LIMIT_4_MS`.
- 관측: `LOG_LEVEL`(pino, 기본 `info`), `METRICS_PORT`(메트릭 전용 포트, 기본 `9091`), `METRICS_TOKEN`(설정 시 `/metrics`에 Bearer/`?token=` 필요).

## 관측 (메트릭 · 로그)
- **메트릭**: **게임 포트(`PORT`)와 분리된 별도 포트 `METRICS_PORT`(기본 9091)** 에서 `GET /metrics`(Prometheus 포맷, `src/metrics.ts`). **게임 포트에는 노출하지 않음** → Traefik이 도메인을 `PORT`로만 라우팅하므로 `https://도메인/metrics`는 404(공개 안 됨). Prometheus는 Docker 네트워크 내부에서 `http://<서비스>:9091/metrics`로 스크레이프.
  - 카운터: `nb_rooms_created_total`·`nb_room_joins_total`·`nb_games_started_total`·`nb_games_over_total`·`nb_guesses_total`(모두 `mode` 라벨)·`nb_socket_connections_total`.
  - 게이지: `nb_sockets_connected`·`nb_rooms_active{mode}`·`nb_players_in_rooms`(스크레이프 시점 계산).
  - 기본: `process_*`/`nodejs_*`(CPU·메모리·이벤트루프 지연 등).
  - `METRICS_TOKEN` 설정 시 인증 필요.
- **로그**: pino 구조화 JSON → stdout(`src/logger.ts`). Docker/Dokploy 로그 뷰어에서 확인. 방코드·소켓id 컨텍스트 포함(연결/방 생성/입장/시작/종료/이탈). 로컬 가독성: `pnpm dev | npx pino-pretty`.

## 프로토콜(요약)
- 클→서: `create{nick,digits}` · `join{nick,code}` · `setSecret{secret}` · `guess{guess}` · `rematch` (ack 콜백 있음)
- 서→클: `opponentJoined` · `phase(secret)` · `secretProgress` · `start{turn}` · `turn{turn}` · `opponentGuessed` · `over{outcome,secrets,attempts}` · `opponentLeft` · `errorMsg`
- 이벤트 타입은 `src/types.ts`. 프론트 net 레이어가 이 형태를 그대로 맞춘다.

## 배포 (Dokploy)
셀프호스팅 **Dokploy**(Docker + Traefik)로 배포한다. 프론트가 HTTPS(Vercel)라 **WebSocket도 `wss://` 필수** → Traefik이 Let's Encrypt로 자동 TLS.
- 리포 **루트 `Dockerfile`**(루트 컨텍스트에서 `server/`만 빌드)로 이미지 빌드.
- Dokploy가 GitHub(`dlwhsk0/number-baseball`, `main`) 연동 → **`main`에 push하면 자동 재배포**(webhook).
- 현재 도메인 `wss://homerun.techeer.cloud-yaho.cloud`, 컨테이너 포트 `3001`, `CORS_ORIGIN`=프론트 Vercel 주소.
- 상태가 메모리라 **반드시 단일 인스턴스(replicas=1)**.
- **상세 절차·공유 Dokploy·트러블슈팅**: [`../docs/dokploy-deploy.md`](../docs/dokploy-deploy.md).

라이브 스모크(배포 후 검증):
```bash
URL=https://homerun.techeer.cloud-yaho.cloud node test/e2e.mjs
URL=https://homerun.techeer.cloud-yaho.cloud node test/speed-rules-smoke.mjs
```

## 재배포
`main`에 push하면 Dokploy webhook이 **자동으로** 빌드·재배포한다(수동 스크립트 불필요).
(옛 오라클 VM + Caddy + pm2(`scripts/redeploy-server.sh`) 방식은 제거됨 — 이력은 태그 `v1.0.0-pre-dokploy` 참고.)
