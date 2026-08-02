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

## 배포(오라클 Always Free VM)
프론트가 HTTPS(Vercel)라 **WebSocket도 `wss://` 필수** → Caddy가 자동 TLS + 리버스 프록시. 도메인이 없으면 `sslip.io` 사용.

**1) VM 생성(OCI 콘솔)** — Ampere(ARM) 또는 AMD Micro, Ubuntu 22.04/24.04. 공인 IP 확보.
**2) 방화벽** — ① VCN Security List에 Ingress TCP 80·443 (0.0.0.0/0) 추가, ② 인스턴스 iptables도 개방:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```
**3) 런타임 설치**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable && sudo npm i -g pm2
```
**4) 코드 + 서버 실행**
```bash
git clone https://github.com/dlwhsk0/number-baseball.git
cd number-baseball/server && git checkout feat/online-duel   # (main 머지 후엔 생략)
pnpm install && pnpm build
CORS_ORIGIN=https://number-baseball-chi.vercel.app PORT=3001 pm2 start dist/index.js --name nb-server
pm2 save && pm2 startup   # 출력되는 명령 한 줄 실행(부팅 시 자동 시작)
```
**5) Caddy(자동 wss TLS)**
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
# Caddyfile.example을 /etc/caddy/Caddyfile로 복사하고 <HOST>를 <공인IP>.sslip.io 로 교체
sudo systemctl restart caddy
```
**6) 프론트 연결** — Vercel 프로젝트 env `VITE_SERVER_URL = wss://<HOST>` 설정 후 재배포.
   접속 확인: `https://<HOST>/health` → `ok`.

## 재배포(서버 코드 수정 후)
서버 코드를 고쳐 `main`에 올렸으면 VM을 다시 배포해야 반영된다. 로컬에서:
```bash
cp scripts/deploy.env.example scripts/deploy.env   # 최초 1회, NB_SSH 채우기
scripts/redeploy-server.sh                          # SSH 접속 → git pull → build → pm2 restart
```
`deploy.env`(접속 정보)는 gitignore 되어 커밋되지 않는다. 스크립트는 `git reset --hard origin/<브랜치>` 후
`pnpm -C server build` → `pm2 restart nb-server` 까지 한 번에 수행한다. 수동으로 하려면 VM에서:
`git pull && pnpm -C server build && pm2 restart nb-server`.
