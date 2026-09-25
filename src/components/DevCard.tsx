import { Seg7 } from './Seg7';

/**
 * 이스터에그 개발자 카드 — 야구장 입장권 모양.
 * 설정 시트 좌상단의 흐릿한 야구공을 일곱 번 누르면 열린다.
 * 배경 탭으로는 안 닫힌다(백드롭에 onClick 없음) — [닫기]로만.
 */
interface Props {
  onClose: () => void;
}

export function DevCard({ onClose }: Props) {
  // 클래스에 modal-backdrop을 함께 둬야 Keypad의 전역 키보드 가드(뒤 게임으로 숫자 入力 방지)가 걸린다.
  return (
    <div className="modal-backdrop dev-modal-backdrop">
      <div className="dev-modal" role="dialog" aria-modal="true">
        <div className="dticket">
          <div className="dticket-stub" aria-hidden="true">
            <span className="dticket-admit">ADMIT ONE</span>
            <span className="dticket-no">
              <Seg7 char="0" />
              <Seg7 char="1" />
            </span>
          </div>
          <div className="dticket-main">
            <span className="dticket-kicker">DEVELOPER PASS</span>
            <div className="dev-emblem">⚾</div>
            <h3 className="dev-title">개발자: 저를 찾아내셨군요!</h3>
            <p className="dticket-sub">이 표 한 장이면 어느 경기든 프리패스.</p>
            <a
              className="dev-link"
              href="https://github.com/dlwhsk0"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon />
              <span>dlwhsk0</span>
            </a>
            <button type="button" className="dev-close" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
