import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GameState, MemoMark } from '../game/useGame';
import { cycleMemoMark } from '../game/useGame';
import { isValidGuess } from '../game/logic';
import type { RankedResult } from '../net/protocol';

/**
 * 엑셀 위장 테마의 솔로 게임 — 전광판·타자석 대신 '진짜 셀'에서 한다.
 *   1행 제목 · 2~3행 숫자 메모(클릭하면 O→B→S 조건부 서식) · 5행 머리글 · 6행부터 추측 기록.
 *   다음 빈 행의 B열이 입력 셀: 숫자를 치고 Enter(모바일은 셀을 탭하면 숫자 키보드).
 *   규칙에 안 맞으면 엑셀 '데이터 유효성' 경고창. 셀을 누르면 이름 상자·수식 입력줄이 따라간다.
 * 판정은 안 한다 — App이 넘긴 onSubmit(연습=로컬 판정, 랭킹전=서버)을 부를 뿐.
 */

const XL_COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HEAD_ROW = 5;
const FIRST_ROW = HEAD_ROW + 1;
const MEMO_ROWS = [
  ['1', '2', '3', '4', '5'],
  ['6', '7', '8', '9', '0'],
];

interface Cell {
  v?: ReactNode;
  /** 수식 입력줄에 보일 값(없으면 v가 문자열일 때 그대로). */
  f?: string;
  cls?: string;
  onClick?: () => void;
  editor?: boolean;
}

interface Props {
  state: GameState;
  onSubmit: (guess: string) => void;
  onMemo: (digit: string, mark: MemoMark) => void;
  onMemoClear: () => void;
  onNewGame: () => void;
  onShare: () => void;
  /** 랭킹전 서버 판정 대기 중인 추측. */
  pending: string | null;
  ranked: RankedResult | null;
  /** 선택한 셀 → 이름 상자·수식 입력줄(ExcelChrome). */
  onSelect: (bar: { ref: string; text: string } | null) => void;
}

export function ExcelSolo({
  state,
  onSubmit,
  onMemo,
  onMemoClear,
  onNewGame,
  onShare,
  pending,
  ranked,
  onSelect,
}: Props) {
  const { guesses, digits, maxAttempts, status, secret, memo } = state;
  const playing = status === 'playing';
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputRow = FIRST_ROW + guesses.length;
  const inputKey = `B${inputRow}`;
  const [sel, setSel] = useState(inputKey);

  // 새 행으로 넘어가면(추측 반영·새 게임) 입력 셀을 다시 선택하고 비운다.
  useEffect(() => {
    setSel(inputKey);
    setDraft('');
  }, [inputKey]);
  useEffect(() => {
    if (playing && !pending && window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus();
  }, [playing, pending, inputKey]);

  // 데스크톱은 어느 셀을 눌러도 입력 셀에 계속 타이핑되게(엑셀처럼 바로 입력). 폰은 키보드가 튀어나오니 안 함.
  const refocus = () => {
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus();
  };

  const submit = () => {
    if (!playing || pending) return;
    if (!isValidGuess(draft, digits)) {
      setInvalid(true);
      return;
    }
    onSubmit(draft);
  };

  const cycleMemo = (d: string) => {
    const cur = memo[d] ?? null;
    const next = cycleMemoMark(cur);
    if (next) onMemo(d, next);
    else if (cur) onMemo(d, cur); // 같은 표시로 토글 = 해제
  };

  const idx = Array.from({ length: digits }, (_, i) => i + 1).join(',');
  const cells = useMemo(() => {
    const m = new Map<string, Cell>();
    m.set('A1', { v: '3분기 실적 집계', cls: 'xl-title-cell' });
    m.set('E1', { v: `${guesses.length}/${maxAttempts}`, cls: 'xl-r xl-muted' });
    MEMO_ROWS.forEach((row, ri) =>
      row.forEach((d, ci) => {
        const mark = memo[d];
        m.set(`${XL_COLS[ci]}${ri + 2}`, {
          v: d,
          cls: `xl-c xl-memo${mark ? ` m-${mark}` : ''}`,
          onClick: () => cycleMemo(d),
        });
      }),
    );
    if (Object.keys(memo).length > 0)
      m.set('A4', { v: '메모 지우기', cls: 'xl-link', onClick: onMemoClear });
    else m.set('A4', { v: '※ 숫자 클릭: O → B → S', cls: 'xl-muted xl-small' });

    ['No', '코드', 'S', 'B', 'O'].forEach((h, ci) =>
      m.set(`${XL_COLS[ci]}${HEAD_ROW}`, { v: h, cls: 'xl-head-cell xl-c' }),
    );
    guesses.forEach((g, i) => {
      const r = FIRST_ROW + i;
      const s = g.judgement.strikes;
      const b = g.judgement.balls;
      const o = digits - s - b;
      const win = status === 'won' && i === guesses.length - 1;
      const rowCls = win ? ' xl-winrow' : '';
      m.set(`A${r}`, { v: i + 1, cls: `xl-c xl-muted${rowCls}` });
      m.set(`B${r}`, { v: g.guess, cls: `xl-r${rowCls}` });
      m.set(`C${r}`, {
        v: s,
        f: `=SUMPRODUCT(--(MID(B${r},{${idx}},1)=MID(기준값,{${idx}},1)))`,
        cls: `xl-r${s ? ' f-s' : ' xl-zero'}${rowCls}`,
      });
      m.set(`D${r}`, {
        v: b,
        f: `=SUMPRODUCT(--ISNUMBER(FIND(MID(B${r},{${idx}},1),기준값)))-C${r}`,
        cls: `xl-r${b ? ' f-b' : ' xl-zero'}${rowCls}`,
      });
      m.set(`E${r}`, {
        v: o,
        f: `=${digits}-C${r}-D${r}`,
        cls: `xl-r${o ? ' f-o' : ' xl-zero'}${rowCls}`,
      });
    });

    if (playing) {
      m.set(`A${inputRow}`, { v: guesses.length + 1, cls: 'xl-c xl-muted' });
      if (pending) {
        m.set(inputKey, { v: pending, cls: 'xl-r' });
        ['C', 'D', 'E'].forEach((c) => m.set(`${c}${inputRow}`, { v: '#BUSY!', cls: 'xl-r xl-muted' }));
      } else {
        m.set(inputKey, { editor: true, f: draft });
      }
    } else {
      const r = inputRow + 1;
      m.set(`A${r}`, { v: '결과', cls: 'xl-head-cell' });
      m.set(`B${r}`, {
        v: status === 'won' ? '달성' : '미달',
        cls: `xl-c ${status === 'won' ? 'f-b' : 'f-o'}`,
      });
      m.set(`C${r}`, { v: '기준값', cls: 'xl-head-cell' });
      m.set(`D${r}`, { v: secret || '-', cls: 'xl-r' });
      let next = r + 1;
      if (ranked) {
        m.set(`A${next}`, { v: '점수', cls: 'xl-head-cell' });
        m.set(`B${next}`, { v: `+${ranked.points}`, cls: 'xl-r' });
        m.set(`C${next}`, { v: '팀 순위', cls: 'xl-head-cell' });
        m.set(`D${next}`, { v: `${ranked.teamRank}위`, cls: 'xl-r' });
        next += 1;
      }
      m.set(`B${next + 1}`, { v: '↻ 새 문서', cls: 'xl-link', onClick: onNewGame });
      m.set(`D${next + 1}`, { v: '공유', cls: 'xl-link', onClick: onShare });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses, digits, maxAttempts, status, secret, memo, pending, ranked, draft, playing, inputRow]);

  // 이름 상자·수식 입력줄 동기화.
  useEffect(() => {
    const c = cells.get(sel);
    const text = c?.f ?? (typeof c?.v === 'string' || typeof c?.v === 'number' ? String(c.v) : '');
    onSelect({ ref: sel, text });
  }, [sel, cells, onSelect]);
  useEffect(() => () => onSelect(null), [onSelect]);

  const rows = Math.max(40, inputRow + 16);
  const cols = XL_COLS.length;

  return (
    <div className="xl-ws" role="grid" aria-label="시트">
      <div className="xl-ws-grid" style={{ gridTemplateRows: `repeat(${rows + 1}, var(--xl-row))` }}>
        <span className="xl-h xl-h-corner" />
        {XL_COLS.map((c) => (
          <span key={c} className={`xl-h xl-h-col${sel.replace(/\d+$/, '') === c ? ' on' : ''}`}>
            {c}
          </span>
        ))}
        {Array.from({ length: rows }, (_, ri) => {
          const r = ri + 1;
          const selRow = Number(sel.replace(/^[A-Z]+/, ''));
          return [
            <span key={`h${r}`} className={`xl-h xl-h-row${selRow === r ? ' on' : ''}`}>
              {r}
            </span>,
            ...Array.from({ length: cols }, (_, ci) => {
              const key = `${XL_COLS[ci]}${r}`;
              const c = cells.get(key);
              const selected = key === sel;
              const cls = `xl-cell${c?.cls ? ` ${c.cls}` : ''}${selected ? ' sel' : ''}${c?.onClick ? ' clickable' : ''}`;
              if (c?.editor)
                return (
                  <label key={key} className={`${cls} xl-editor`} onClick={() => setSel(key)}>
                    <input
                      ref={inputRef}
                      className="xl-edit"
                      value={draft}
                      inputMode="numeric"
                      enterKeyHint="done"
                      autoComplete="off"
                      maxLength={digits}
                      aria-label={`${digits}자리 숫자 입력`}
                      onFocus={() => setSel(key)}
                      onChange={(e) => {
                        setSel(key);
                        setDraft(e.target.value.replace(/\D/g, '').slice(0, digits));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submit();
                        } else if (e.key === 'Escape') setDraft('');
                      }}
                    />
                  </label>
                );
              return (
                <span
                  key={key}
                  className={cls}
                  // 데스크톱: 다른 셀을 눌러도 입력 셀 포커스를 뺏지 않는다(계속 타이핑 가능).
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSel(key);
                    c?.onClick?.();
                    refocus();
                  }}
                >
                  {c?.v}
                </span>
              );
            }),
          ];
        })}
      </div>

      {invalid && (
        <div className="modal-backdrop xl-dialog-backdrop" onClick={() => setInvalid(false)}>
          <div className="xl-dialog" role="alertdialog" aria-labelledby="xl-dv-msg" onClick={(e) => e.stopPropagation()}>
            <div className="xl-dialog-title">데이터 유효성</div>
            <div className="xl-dialog-body">
              <span className="xl-dialog-icon" aria-hidden="true">
                ✕
              </span>
              <div>
                <p id="xl-dv-msg">이 값은 이 셀에 정의된 데이터 유효성 검사 제한과 일치하지 않습니다.</p>
                <p className="xl-muted xl-small">
                  서로 다른 숫자 {digits}자리만 입력할 수 있습니다(맨 앞자리 0 제외).
                </p>
              </div>
            </div>
            <div className="xl-dialog-actions">
              <button
                type="button"
                className="xl-btn primary"
                autoFocus
                onClick={() => {
                  setInvalid(false);
                  inputRef.current?.focus();
                }}
              >
                다시 시도
              </button>
              <button
                type="button"
                className="xl-btn"
                onClick={() => {
                  setInvalid(false);
                  setDraft('');
                  refocus();
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
