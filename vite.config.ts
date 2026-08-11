import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 빌드 타깃. `pnpm build:offline` → 서버 없이 도는 오프라인 전용 빌드.
// 앱인토스 미니앱 업로드와 원스토어용 안드로이드 APK(웹뷰 래핑)에 같은 결과물을 쓴다.
//  - 온라인 대전 제거: `@versus/online`을 빈 스텁으로 alias → socket.io-client 미포함
//  - PWA(서비스워커)·설치 안내 제거: 네이티브/웹뷰 컨테이너 안에서 도니 불필요
//  - 상대 경로 base(file:// · 웹뷰 대응) + 별도 outDir(dist-offline)로 결과물 분리
const isOffline = process.env.VITE_TARGET === 'offline'
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  base: isOffline ? './' : '/',
  // 클라이언트 코드에서 `IS_OFFLINE_BUILD`(src/target.ts)로 읽는다. 상수라 죽은 가지는 번들에서 사라진다.
  define: {
    __OFFLINE_BUILD__: JSON.stringify(isOffline),
  },
  resolve: {
    alias: {
      '@versus/online': isOffline
        ? here('./src/versus/online.offline.ts')
        : here('./src/versus/online.ts'),
      // PWA 플러그인을 빼면 가상 모듈도 사라지므로 no-op 훅으로 대체한다.
      ...(isOffline ? { 'virtual:pwa-register/react': here('./src/pwa/register-noop.ts') } : {}),
    },
  },
  build: {
    outDir: isOffline ? 'dist-offline' : 'dist',
  },
  // 개발 전용 — ngrok 등 외부 터널로 모바일 미리보기 허용(빌드엔 영향 없음).
  server: {
    allowedHosts: true,
  },
  plugins: [
    react(),
    ...(isOffline
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: '숫자 야구',
              short_name: '숫자야구',
              description: '서로 다른 세 자리 숫자를 맞히는 숫자 야구 게임',
              lang: 'ko',
              theme_color: '#0f172a',
              background_color: '#0f172a',
              display: 'standalone',
              orientation: 'portrait',
              icons: [
                { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: 'maskable-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
          }),
        ]),
  ],
})
