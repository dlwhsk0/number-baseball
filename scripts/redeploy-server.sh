#!/usr/bin/env bash
#
# 온라인 대전 서버(오라클 VM) 재배포 스크립트.
# 로컬에서 실행하면 SSH로 VM에 접속해 최신 코드를 받아 빌드하고 pm2를 재시작한다.
#
#   서버 코드(server/, src/net/protocol.ts 대응 로직)를 고쳐 main에 올린 뒤 실행.
#   프론트(Vercel)는 자동 배포되지만, 서버는 이 스크립트로 직접 재배포해야 반영된다.
#
# 사용법:
#   scripts/redeploy-server.sh
#
# 접속 정보는 커밋하지 않는다. 아래 중 하나로 지정:
#   1) scripts/deploy.env  (gitignore 됨) — 예:
#        NB_SSH=ubuntu@140.238.x.x.sslip.io
#        NB_SSH_KEY=~/.ssh/oracle_vm         # (선택) 키 경로
#        NB_REMOTE_DIR=~/number-baseball      # (선택) 기본값
#        NB_BRANCH=main                       # (선택) 기본값
#        NB_PM2_NAME=nb-server                # (선택) 기본값
#   2) 환경 변수로 직접: NB_SSH=... scripts/redeploy-server.sh
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 로컬 설정 파일이 있으면 읽는다(민감 정보라 gitignore).
if [[ -f "$HERE/deploy.env" ]]; then
  # shellcheck disable=SC1091
  source "$HERE/deploy.env"
fi

: "${NB_SSH:?NB_SSH가 필요합니다 (예: ubuntu@<공인IP>.sslip.io). scripts/deploy.env 참고}"
# 원격 홈 기준 상대 경로가 기본(ssh 로그인 셸은 홈에서 시작). ~ 는 로컬에서 확장되니 쓰지 말 것.
NB_REMOTE_DIR="${NB_REMOTE_DIR:-number-baseball}"
NB_BRANCH="${NB_BRANCH:-main}"
NB_PM2_NAME="${NB_PM2_NAME:-nb-server}"

SSH_ARGS=()
if [[ -n "${NB_SSH_KEY:-}" ]]; then
  SSH_ARGS+=(-i "${NB_SSH_KEY/#\~/$HOME}")
fi

echo "▶ 재배포 시작 → $NB_SSH ($NB_REMOTE_DIR, 브랜치 $NB_BRANCH)"

# VM에서 실행할 원격 스크립트. 실패하면 즉시 중단(set -e).
ssh "${SSH_ARGS[@]}" "$NB_SSH" NB_REMOTE_DIR="$NB_REMOTE_DIR" NB_BRANCH="$NB_BRANCH" NB_PM2_NAME="$NB_PM2_NAME" 'bash -s' <<'REMOTE'
set -euo pipefail
# corepack(pnpm)·pm2가 PATH에 있도록 로그인 셸 환경을 보정.
export PATH="$HOME/.local/share/pnpm:$HOME/.npm-global/bin:/usr/local/bin:$PATH"
cd "${NB_REMOTE_DIR/#\~/$HOME}"

echo "· git fetch/checkout $NB_BRANCH"
git fetch --prune origin
git checkout "$NB_BRANCH"
git reset --hard "origin/$NB_BRANCH"

echo "· pnpm install & build (server)"
pnpm -C server install --frozen-lockfile
pnpm -C server build

echo "· pm2 restart $NB_PM2_NAME"
if pm2 describe "$NB_PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$NB_PM2_NAME" --update-env
else
  echo "  (프로세스 없음 — 새로 기동. CORS_ORIGIN 필요하면 deploy.env 대신 VM에서 직접 지정)"
  pm2 start server/dist/index.js --name "$NB_PM2_NAME"
fi
pm2 save
echo "· 완료. 상태:"
pm2 describe "$NB_PM2_NAME" | grep -E "status|uptime|restarts" || true
REMOTE

echo "✔ 재배포 완료. 헬스체크는 브라우저에서 https://<HOST>/health → ok 확인"
