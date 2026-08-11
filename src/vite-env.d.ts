/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/** vite.config.ts의 `define`으로 주입되는 빌드 타깃 상수. src/target.ts에서만 읽는다. */
declare const __OFFLINE_BUILD__: boolean;
