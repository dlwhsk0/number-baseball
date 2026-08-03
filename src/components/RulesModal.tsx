import { useEffect, useRef, useState } from 'react';
import { toggleMemoMark, type MemoMark } from '../game/useGame';
import { Keypad } from './Keypad';
import { Seg7 } from './Seg7';

interface Props {
  onClose: () => void;
}

/**
 * 게임 방법 — 단계별 튜토리얼. 규칙을 직관적으로 보여주고,
 * 메모(키패드 O/B/S · 칸 길게 눌러 후보)를 직접 눌러보며 익힌다.
 */
export function RulesModal({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const steps = [Intro, Judge, MemoKeypadDemo, SlotMemoDemo, Wrap];
  const last = steps.length - 1;
  const Body = steps[step];

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
        className="modal tut"
        role="dialog"
        aria-modal="true"
        aria-label="게임 방법"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tut-skip" onClick={onClose}>
          건너뛰기
        </button>
        <div className="tut-dots" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={`tut-dot${i === step ? ' on' : ''}`} />
          ))}
        </div>

        <div className="modal-content tut-body">
          <Body />
        </div>

        <div className="tut-nav">
          <button
            type="button"
            className="tut-btn ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            이전
          </button>
          <span className="tut-count">
            {step + 1} / {steps.length}
          </span>
          {step === last ? (
            <button type="button" className="tut-btn primary" onClick={onClose}>
              시작하기 ⚾
            </button>
          ) : (
            <button type="button" className="tut-btn primary" onClick={() => setStep((s) => s + 1)}>
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 작은 세그먼트 셀(예시용). */
function MiniCell({ char, tone }: { char: string; tone?: 'strike' | 'ball' | 'out' }) {
  return (
    <span className={`tut-cell cell${tone ? ` tone-${tone}` : ''}`}>
      <Seg7 char={char} />
    </span>
  );
}

// ── 1. 소개 ─────────────────────────────────────────
function Intro() {
  return (
    <div className="tut-step">
      <h2 className="modal-title">숫자 야구 ⚾</h2>
      <p className="tut-lead">
        컴퓨터가 몰래 정한 <strong>세 자리 숫자</strong>를 추리로 맞혀보는 게임이에요.
      </p>
      <div className="tut-hidden">
        <MiniCell char="" />
        <MiniCell char="" />
        <MiniCell char="" />
      </div>
      <div className="tut-rules">
        <div className="tut-rule">
          <span className="tut-rule-ico">🔢</span>
          <span>
            각 자리는 <strong>0~9</strong>, <strong>서로 겹치지 않아요.</strong>
          </span>
        </div>
        <div className="tut-rule">
          <span className="tut-rule-ico">🚫</span>
          <span>
            맨 앞자리에는 <strong>0이 올 수 없어요.</strong>
          </span>
        </div>
        <div className="tut-rule">
          <span className="tut-rule-ico">🎯</span>
          <span>
            <strong>10번</strong> 안에 모두 맞히면 승리!
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 2. 판정 S·B·O ───────────────────────────────────
function Judge() {
  return (
    <div className="tut-step">
      <h2 className="modal-title">얼마나 맞았는지 알려줘요</h2>
      <p className="tut-lead">
        숫자를 넣으면 정답과 비교해서, 자리마다 이렇게 알려줘요.
      </p>

      <div className="tut-legend">
        <div className="tut-leg">
          <span className="tag tag-strike">스트라이크</span> 숫자와 자리가 모두 맞았어요
        </div>
        <div className="tut-leg">
          <span className="tag tag-ball">볼</span> 숫자는 맞지만 자리가 달라요
        </div>
        <div className="tut-leg">
          <span className="tag tag-out">아웃</span> 정답에 없는 숫자예요
        </div>
      </div>

      <div className="tut-eg">
        <div className="tut-eg-row">
          <span className="tut-eg-label">정답</span>
          <MiniCell char="1" />
          <MiniCell char="2" />
          <MiniCell char="3" />
        </div>
        <div className="tut-eg-row">
          <span className="tut-eg-label">내 추측</span>
          <div className="tut-eg-cell">
            <MiniCell char="1" tone="strike" />
            <span className="tut-eg-verdict mark-s">S</span>
          </div>
          <div className="tut-eg-cell">
            <MiniCell char="3" tone="ball" />
            <span className="tut-eg-verdict mark-b">B</span>
          </div>
          <div className="tut-eg-cell">
            <MiniCell char="5" tone="out" />
            <span className="tut-eg-verdict mark-o">O</span>
          </div>
        </div>
      </div>
      <ul className="tut-explain">
        <li>
          <b className="mark-s">1</b> — 자리까지 딱 맞았어요 → 스트라이크
        </li>
        <li>
          <b className="mark-b">3</b> — 정답에 있지만 자리가 달라요 → 볼
        </li>
        <li>
          <b className="mark-o">5</b> — 정답에 없어요 → 아웃
        </li>
      </ul>
      <p className="tut-result">
        그래서 <b className="mark-s">S 1</b> · <b className="mark-b">B 1</b> ·{' '}
        <b className="mark-o">O 1</b>
      </p>
    </div>
  );
}

// ── 3. 키패드 메모 (직접 눌러보기) ──────────────────
function MemoKeypadDemo() {
  const [memo, setMemo] = useState<Record<string, MemoMark>>({});
  const [mark, setMark] = useState<MemoMark | null>('out');
  const placed = Object.keys(memo).length;

  return (
    <div className="tut-step">
      <h2 className="modal-title">키패드에 메모하기 ✎</h2>
      <p className="tut-lead">
        추리하면서 알아낸 걸 키패드에 표시해둘 수 있어요. <strong>직접 눌러보세요!</strong>
      </p>
      <ol className="tut-try">
        <li>
          먼저 <b className="mark-o">O</b>·<b className="mark-b">B</b>·<b className="mark-s">S</b>{' '}
          중 하나를 고르고
        </li>
        <li>숫자를 누르면 표시가 붙어요. 다시 누르면 지워지고요.</li>
      </ol>
      <div className="tut-pad">
        <Keypad
          slots={['1', '2', '3']}
          memo={memo}
          memoMark={mark}
          markButtons
          disabled={false}
          onPickMark={(m) => setMark((cur) => (cur === m ? null : m))}
          onMemo={(d) => mark && setMemo((mm) => toggleMemoMark(mm, d, mark))}
          onClearMemo={() => setMemo({})}
          onDigit={() => {}}
          onDelete={() => {}}
          onSubmit={() => {}}
        />
      </div>
      <p className={`tut-nudge${placed ? ' done' : ''}`}>
        {placed
          ? '좋아요! 이건 나만 보는 메모라 숫자 입력에는 영향을 주지 않아요.'
          : '👆 여기서 한번 눌러보세요'}
      </p>
    </div>
  );
}

// ── 4. 칸 길게 눌러 후보 메모 (숨은 기능) ────────────
function SlotMemoDemo() {
  const digits = ['1', '2', '3'];
  const [notes, setNotes] = useState<string[][]>([[], [], []]);
  const [editing, setEditing] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const holdRef = useRef<number | undefined>(undefined);
  const firedRef = useRef(false);

  const start = (i: number) => {
    firedRef.current = false;
    holdRef.current = window.setTimeout(() => {
      firedRef.current = true;
      setEditing(i);
      setOpened(true);
    }, 400);
  };
  const cancel = () => {
    if (holdRef.current !== undefined) {
      window.clearTimeout(holdRef.current);
      holdRef.current = undefined;
    }
  };
  const toggle = (pos: number, d: string) =>
    setNotes((n) =>
      n.map((arr, i) =>
        i !== pos ? arr : arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d],
      ),
    );

  return (
    <div className="tut-step">
      <h2 className="modal-title">
        칸을 <span className="mark-s">꾹</span> 눌러 후보 메모
      </h2>
      <p className="tut-lead">
        “이 자리는 3 아니면 7”처럼 후보가 좁혀질 때가 있죠. <strong>숫자 칸을 길게 누르면</strong> 그
        자리에 올 수 있는 숫자를 적어둘 수 있어요.
      </p>
      <p className={`tut-nudge big${opened ? ' done' : ''}`}>
        {opened
          ? '바로 이거예요! 적어둔 후보는 칸 오른쪽 위에 작게 보여요.'
          : '👇 아래 숫자 칸을 꾹 눌러보세요'}
      </p>

      <div className="tut-slots">
        <div className="input-display" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {digits.map((d, i) => (
            <button
              key={i}
              type="button"
              className={`slot cell filled${editing === i ? ' editing' : ''}`}
              onPointerDown={() => start(i)}
              onPointerUp={cancel}
              onPointerLeave={cancel}
              onClick={() => {
                if (firedRef.current) {
                  firedRef.current = false;
                  return;
                }
              }}
            >
              <Seg7 char={d} />
              {notes[i].length > 0 && (
                <span className="slot-cands" aria-hidden="true">
                  {notes[i].join('')}
                </span>
              )}
            </button>
          ))}
        </div>

        {editing !== null && (
          <div className="note-pop" role="dialog" aria-label={`${editing + 1}번 칸 후보`}>
            <div className="note-pop-head">
              <span className="note-pop-title">{editing + 1}번 칸 후보</span>
              <button
                type="button"
                className="note-pop-clear"
                disabled={notes[editing].length === 0}
                onClick={() => setNotes((n) => n.map((a, i) => (i === editing ? [] : a)))}
              >
                비우기
              </button>
              <button
                type="button"
                className="note-pop-close"
                aria-label="닫기"
                onClick={() => setEditing(null)}
              >
                ✕
              </button>
            </div>
            <div className="note-pop-nums">
              {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((dd) => (
                <button
                  key={dd}
                  type="button"
                  className={`note-num${notes[editing].includes(dd) ? ' on' : ''}`}
                  aria-pressed={notes[editing].includes(dd)}
                  onClick={() => toggle(editing, dd)}
                >
                  {dd}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 5. 마무리 (대결 · 설정) ─────────────────────────
function Wrap() {
  return (
    <div className="tut-step">
      <h2 className="modal-title">준비 끝! 🎉</h2>
      <p className="tut-lead">이제 시작해볼까요? 이런 것도 있어요.</p>

      <h3>⚙ 설정</h3>
      <ul className="tut-list">
        <li>
          <strong>자릿수</strong> — <b>3자리</b>와 <b>4자리</b> 중에 고를 수 있어요.
        </li>
        <li>
          <strong>힌트</strong> — 켜면 넣은 숫자가 전부 아웃일 때 자동으로 ✕ 표시를 해줘요.
        </li>
      </ul>

      <h3>🆚 친구와 대결</h3>
      <ul className="tut-list">
        <li>
          <strong>⚡ 스피드</strong> — 같은 숫자를 함께 풀어, <b>적은 횟수·빠른 시간</b>이 이겨요(2~4명).
        </li>
        <li>
          <strong>🥎 주고받기</strong> — 서로 낼 숫자를 정하고 번갈아 맞히는 1:1이에요.
        </li>
        <li>온라인(방 코드로 초대) · 오프라인(한 기기를 주고받기) 둘 다 돼요.</li>
      </ul>
    </div>
  );
}
