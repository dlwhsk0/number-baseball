# 숫자 야구 온라인 서버 — Docker/Dokploy 배포용.
# 빌드 컨텍스트는 이 폴더(server/). 모노레포 하위지만 루트 의존 없이 독립 빌드된다.
#   Dokploy 설정: Build Path(Base Directory)=/server, Dockerfile Path=Dockerfile
#
# 상태(방)는 메모리에만 있으므로 반드시 단일 인스턴스(replicas=1)로 실행할 것.

# --- 빌드 스테이지: TS → dist ---
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# --- 런타임 스테이지: 프로덕션 의존성만 ---
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
EXPOSE 3001

# 컨테이너 자체 헬스체크(/health). Node 22 전역 fetch 사용.
HEALTHCHECK --interval=30s --timeout=5s --start-period=8s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
