# 숫자 야구 온라인 서버 — Docker/Dokploy 배포용 (리포 루트 컨텍스트).
# Dokploy 기본 설정으로 바로 동작한다: Build Path=`/`, Docker File=`Dockerfile`.
# 서버는 모노레포의 server/ 폴더 → 루트 컨텍스트에서 그 폴더만 빌드한다.
#
# 상태(방)는 메모리에만 있으므로 반드시 단일 인스턴스(replicas=1)로 실행할 것.

# --- 빌드 스테이지: TS → dist ---
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY server/tsconfig.json ./
COPY server/src ./src
RUN pnpm build

# --- 런타임 스테이지: 프로덕션 의존성만 ---
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
EXPOSE 3001

# 컨테이너 자체 헬스체크(/health). Node 22 전역 fetch 사용.
HEALTHCHECK --interval=30s --timeout=5s --start-period=8s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
