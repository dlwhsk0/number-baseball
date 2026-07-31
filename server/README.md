# 숫자 야구 · 온라인 대결 서버

턴제 1:1 대결용 Socket.IO 서버. **방 코드**로 입장하고, **서버가 정답을 쥐고 판정**한다(상대가 서로의 비밀 숫자를 볼 수 없음). 상태는 메모리에만 있고(영속화 없음) 한 명이라도 나가면 방이 정리된다.

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

## 프로토콜(요약)
- 클→서: `create{nick,digits}` · `join{nick,code}` · `setSecret{secret}` · `guess{guess}` · `rematch` (ack 콜백 있음)
- 서→클: `opponentJoined` · `phase(secret)` · `secretProgress` · `start{turn}` · `turn{turn}` · `opponentGuessed` · `over{outcome,secrets,attempts}` · `opponentLeft` · `errorMsg`
- 이벤트 타입은 `src/types.ts`. 프론트 net 레이어가 이 형태를 그대로 맞춘다.

## 배포(오라클 VM, 예정)
- Ampere ARM 프리티어 VM에 Node 설치 → `pnpm build && pnpm start`(pm2/systemd로 상시 실행).
- 프론트가 HTTPS라 **WebSocket도 `wss://` 필수** → 도메인 + Caddy(자동 Let's Encrypt)로 리버스 프록시.
- 자세한 절차는 이후 단계에서 문서화.
