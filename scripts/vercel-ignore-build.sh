#!/usr/bin/env bash
# Vercel "Ignored Build Step"용 — 프론트엔드 관련 변경이 있을 때만 빌드한다.
# (백엔드 server/ 나 docs/ 만 바뀐 push는 프론트 빌드를 스킵.)
#
# Vercel 규약: 이 명령의 종료코드가
#   1 → 빌드 진행,  0 → 빌드 스킵.
#
# 설정: Vercel → 프로젝트 → Settings → Git → "Ignored Build Step" 에
#   bash scripts/vercel-ignore-build.sh
# 를 넣는다.

# 이전 커밋(비교 기준). Vercel이 주는 값 우선, 없으면 HEAD^.
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"

# 이전 커밋을 못 찾으면(첫 배포·얕은 클론 등) 안전하게 빌드한다.
if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  echo "비교 기준 커밋 없음 → 빌드 진행"
  exit 1
fi

# server/·docs/·store-assets/ '밖'에 변경이 있으면(=프론트 변경) 빌드, 없으면 스킵.
if git diff --quiet "$base" HEAD -- \
  ':(exclude)server' \
  ':(exclude)docs' \
  ':(exclude)store-assets'; then
  echo "프론트 변경 없음(server/docs/store-assets만) → 빌드 스킵"
  exit 0
else
  echo "프론트 변경 있음 → 빌드 진행"
  exit 1
fi
