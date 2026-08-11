import { useEffect, useRef } from 'react';

/**
 * 안드로이드 하드웨어 뒤로가기 버튼 처리 — Capacitor APK(원스토어) 빌드용 실제 구현.
 *
 * Capacitor 기본 동작은 "웹뷰 히스토리가 없으면 앱 종료"인데, 이 앱은 라우터가 없어
 * 히스토리가 항상 비어 있다 → 게임 도중에 잘못 누르면 그대로 꺼진다. 그래서 직접 가로챈다.
 *
 * @param onBack 뒤로 갈 곳이 있으면 처리하고 `true`를 반환. `false`면 종료 절차로 넘어간다.
 * @param onWarnExit 최상위에서 처음 눌렀을 때 호출(예: "한 번 더 누르면 종료" 토스트).
 *
 * 웹/앱인토스 빌드에는 `backButton.ts`(빈 훅)가 alias로 대신 들어간다 → @capacitor/* 미포함.
 */
export function useAndroidBackButton(onBack: () => boolean, onWarnExit: () => void) {
  // 콜백을 ref로 들고 있어야 리스너를 매번 다시 붙이지 않는다.
  const backRef = useRef(onBack);
  const warnRef = useRef(onWarnExit);
  backRef.current = onBack;
  warnRef.current = onWarnExit;

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let disposed = false;
    // 두 번 연속(2초 내) 눌러야 종료 — 실수로 게임이 꺼지는 걸 막는다.
    let armedAt = 0;

    (async () => {
      const [{ Capacitor }, { App }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/app'),
      ]);
      // 하드웨어 백 버튼은 네이티브에서만 온다.
      if (!Capacitor.isNativePlatform() || disposed) return;

      const handle = await App.addListener('backButton', () => {
        if (backRef.current()) {
          armedAt = 0;
          return;
        }
        const now = Date.now();
        if (now - armedAt < 2000) {
          App.exitApp();
          return;
        }
        armedAt = now;
        warnRef.current();
      });
      if (disposed) handle.remove();
      else dispose = () => handle.remove();
    })();

    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);
}
