import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

/** 게임 규칙 + 메모 모드 설명을 보여주는 거의 전체 화면 모달. */
export function RulesModal({ onClose }: Props) {
  // ESC로 닫기 + 열려 있는 동안 배경 스크롤 잠금.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="게임 방법"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        <div className="modal-content">
          <h2 className="modal-title">게임 방법 ⚾</h2>
          <p>
            컴퓨터가 정한 <strong>서로 다른 세 자리 숫자</strong>를 맞히는 게임이에요.
          </p>

          <h3>숫자 규칙</h3>
          <ul>
            <li>각 자리는 0~9, <strong>서로 겹치지 않아요.</strong></li>
            <li>맨 앞자리는 <strong>0이 올 수 없어요.</strong></li>
          </ul>

          <h3>판정</h3>
          <ul className="rule-judge">
            <li>
              <span className="tag tag-strike">S 스트라이크</span> 숫자와 자리가 모두 맞음
            </li>
            <li>
              <span className="tag tag-ball">B 볼</span> 숫자는 있지만 자리가 틀림
            </li>
            <li>
              <span className="tag tag-out">O 아웃</span> 아예 없는 숫자
            </li>
          </ul>
          <p className="rule-eg">
            예) 정답 <b>123</b> 에 <b>135</b> 를 넣으면 → <b className="mark-s">S 1</b> ·{' '}
            <b className="mark-b">B 1</b> · <b className="mark-o">O 1</b>
          </p>

          <h3>승리 / 기회</h3>
          <ul>
            <li>자리 수가 <strong>모두 스트라이크</strong>면 승리 🎉</li>
            <li>기회는 <strong>10번</strong>이에요.</li>
          </ul>

          <h3>난이도</h3>
          <ul>
            <li><strong>초보자</strong> — 3자리. <b>자동 힌트</b>: 추측이 전부 아웃이면 그 숫자들을 자동으로 ✕ 표시.</li>
            <li><strong>중급</strong> — 3자리, 힌트 없음.</li>
            <li><strong>고급</strong> — 4자리.</li>
          </ul>

          <h3>친구와 대결 🆚</h3>
          <p>한 기기를 주고받으며(패스앤플레이) 즐겨요.</p>
          <ul>
            <li><strong>스피드 대결</strong> — 공통 숫자를 번갈아 풀고, 적은 횟수(동점이면 빠른 시간)로 승부.</li>
            <li><strong>턴제 대결</strong> — 서로 숫자를 정해 번갈아 한 번씩 상대 숫자를 맞히는 일대일.</li>
          </ul>

          <h3>메모 모드 ✎</h3>
          <p>추리한 내용을 키패드 위에 표시해두는 기능이에요.</p>
          <ul>
            <li>
              <strong>메모 모드</strong>를 켜고 숫자를 누르면 표시가 순환해요:
              <br />
              없음 → <span className="mark-s">○ 스트라이크</span> →{' '}
              <span className="mark-b">△ 볼</span> → <span className="mark-o">✕ 아웃</span> → 없음
            </li>
            <li>표시는 <strong>참고용</strong>이라 실제 입력을 막지 않아요.</li>
            <li>새 게임을 시작하면 메모는 초기화돼요.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
