/**
 * `virtual:pwa-register/react` 대체 스텁(오프라인 빌드 전용).
 *
 * 앱인토스 미니앱(토스 웹뷰)·원스토어 APK(웹뷰 래핑)는 배포를 컨테이너가 맡으므로
 * 서비스워커를 등록하지 않는다(vite-plugin-pwa 자체를 빼서 가상 모듈이 사라짐).
 * App에서 훅 호출을 지우는 대신 아무것도 안 하는 훅으로 바꿔 끼운다.
 */
export function useRegisterSW(_options?: unknown) {
  return {
    needRefresh: [false, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async (_reloadPage?: boolean) => {},
  };
}
