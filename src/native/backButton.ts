import type { useAndroidBackButton as Native } from './backButton.native';

/**
 * 하드웨어 뒤로가기 훅의 **빈 구현**(웹/PWA·앱인토스 빌드).
 *
 * 이쪽에는 하드웨어 백 버튼이 없다 → 아무것도 안 하고, `@capacitor/*`도 번들에 안 들어간다.
 * 오프라인(APK) 빌드에서는 vite alias가 `backButton.native.ts`로 바꿔치기한다.
 */
export const useAndroidBackButton: typeof Native = () => {};
