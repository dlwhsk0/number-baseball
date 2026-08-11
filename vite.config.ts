import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 빌드 타깃 세 가지 (`VITE_TARGET`):
//   (없음)   → dist/         웹·PWA(Vercel). 온라인 대전 포함.
//   offline  → dist-offline/ 앱인토스 미니앱. 서버 없이 도는 오프라인 전용.
//   native   → dist-native/  원스토어 APK/AAB(Capacitor). offline + 하드웨어 백 버튼 처리.
// 오프라인 계열 공통:
//  - 온라인 대전 제거: `@versus/online`을 빈 스텁으로 alias → socket.io-client 미포함
//  - PWA(서비스워커)·설치 안내 제거: 네이티브/웹뷰 컨테이너 안에서 도니 불필요
//  - 상대 경로 base(file:// · 웹뷰 대응)
const target = process.env.VITE_TARGET ?? 'web'
const isNative = target === 'native'
const isOffline = target === 'offline' || isNative
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
      // 하드웨어 백 버튼은 APK에만 있다 → 나머지 타깃엔 빈 훅을 넣어 @capacitor/*를 통째로 뺀다.
      '@native/back-button': isNative
        ? here('./src/native/backButton.native.ts')
        : here('./src/native/backButton.ts'),
      // PWA 플러그인을 빼면 가상 모듈도 사라지므로 no-op 훅으로 대체한다.
      ...(isOffline ? { 'virtual:pwa-register/react': here('./src/pwa/register-noop.ts') } : {}),
    },
  },
  build: {
    outDir: isNative ? 'dist-native' : isOffline ? 'dist-offline' : 'dist',
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
