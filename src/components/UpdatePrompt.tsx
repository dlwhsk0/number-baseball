import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * 새 버전이 배포되면 배너를 띄운다. prompt 방식이라 자동 새로고침은 절대 하지 않고,
 * 사용자가 "새로고침"을 눌러야만 갱신된다 → 게임 중에는 무시하고 계속 플레이 가능(초기화 안 됨).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // 앱을 오래 켜둬도 주기적으로 새 버전을 확인(1시간마다).
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <span className="update-toast-text">업데이트가 있어요.</span>
      <div className="update-toast-actions">
        <button
          type="button"
          className="update-later"
          onClick={() => setNeedRefresh(false)}
        >
          나중에
        </button>
        <button
          type="button"
          className="update-refresh"
          onClick={() => updateServiceWorker(true)}
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
