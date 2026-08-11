import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 원스토어에 낼 안드로이드 APK/AAB 껍데기 설정.
 *
 * `webDir`는 **네이티브 빌드**(`pnpm build:native`) 결과물 — 온라인 대전·서비스워커가 빠지고
 * 하드웨어 백 버튼 처리가 들어간 버전이라 네트워크 없이 그대로 돈다.
 * 웹 자산이 APK 안에 통째로 들어가서 서버를 전혀 안 탄다.
 * 자세한 절차는 docs/apps-in-toss.md.
 */
const config: CapacitorConfig = {
  appId: 'io.github.dlwhsk0.numberbaseball',
  appName: '숫자 야구',
  webDir: 'dist-native',
  // 웹뷰가 뜨기 전/스크롤 바운스에서 보이는 바탕. 앱 배경(--bg)과 맞춰 흰 번쩍임을 막는다.
  backgroundColor: '#05060a',
  android: {
    backgroundColor: '#05060a',
  },
};

export default config;
