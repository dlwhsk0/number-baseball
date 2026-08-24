// 구조화 로그(pino). JSON으로 stdout에 출력 → Docker/Dokploy 로그 뷰어에서 확인.
// 레벨은 LOG_LEVEL(기본 info). 로컬에서 보기 좋게 하려면 `... | npx pino-pretty`.
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { app: 'number-baseball-server' },
});
