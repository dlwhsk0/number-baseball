interface Props {
  show: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

/**
 * 새 버전이 배포되면 하단에 배너를 띄운다. 자동 새로고침은 하지 않는다.
 * - "지금 새로고침"을 눌러야만 갱신 → 게임 중에는 무시하고 계속 플레이(초기화 안 됨).
 * - 어차피 "새 게임"/"다시하기"를 누르면 그 시점에 자동 적용된다(App.newGame 참고).
 */
export function UpdatePrompt({ show, onRefresh, onDismiss }: Props) {
  if (!show) return null;

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <div className="update-toast-body">
        <span className="update-toast-text">업데이트가 있어요.</span>
        <span className="update-toast-hint">
          게임 중이면 나중에 해도 돼요. 게임을 마치고 새 게임을 시작하면 자동 적용돼요.
        </span>
      </div>
      <div className="update-toast-actions">
        <button type="button" className="update-later" onClick={onDismiss}>
          나중에
        </button>
        <button type="button" className="update-refresh" onClick={onRefresh}>
          지금 새로고침
        </button>
      </div>
    </div>
  );
}
