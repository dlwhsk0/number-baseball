/**
 * 빌드 타깃 플래그. `vite.config.ts`의 `define`으로 주입한다.
 *
 * - 기본(웹/PWA, Vercel): `IS_OFFLINE_BUILD === false`
 * - 오프라인 전용: `VITE_TARGET=offline`으로 빌드 → `IS_OFFLINE_BUILD === true`
 *   (앱인토스 미니앱 업로드용, 그리고 원스토어에 낼 안드로이드 APK 껍데기용)
 *
 * 오프라인 빌드에서는 온라인 대전(자체 서버)·PWA 서비스워커·설치 안내를 전부 뺀다.
 * 상수라 번들러가 `if (IS_OFFLINE_BUILD)` 가지를 통째로 지운다(DCE).
 */
export const IS_OFFLINE_BUILD = __OFFLINE_BUILD__;
