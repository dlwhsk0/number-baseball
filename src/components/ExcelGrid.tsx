import { useEffect, type ReactNode } from 'react';
import { XL_COLS, type XlBar, type XlCells } from './excel';

/**
 * 엑셀 위장 테마의 '진짜 시트' — 열/행 머리글(고정) + 셀 격자. 창 틀(ExcelChrome) 사이를 채우고 안쪽만 스크롤.
 * 셀 내용은 시트마다(ExcelSolo·ExcelMulti·ExcelKbo) cells 맵으로 넘긴다. 선택은 제어형(sel/onSel),
 * 선택한 셀의 값·수식은 onBar로 이름 상자·수식 입력줄에 올린다.
 */
interface Props {
  cells: XlCells;
  sel: string;
  onSel: (key: string) => void;
  onBar: (bar: XlBar) => void;
  /** 최소 행 수(내용이 더 길면 그 뒤로 여유 행을 붙인다). */
  minRows?: number;
  /** 셀을 누른 뒤 할 일(예: 데스크톱에서 입력 셀로 포커스 되돌리기). */
  afterClick?: () => void;
  /** 시트 위에 띄울 것(경고창 등). */
  children?: ReactNode;
  /** 열 너비 배율(예: { B: 1.7 }) — 긴 이름이 옆 칸 숫자와 겹치지 않게. */
  widths?: Partial<Record<string, number>>;
}

const rowOf = (key: string) => Number(key.replace(/^[A-Z]+/, ''));
const colOf = (key: string) => key.replace(/\d+$/, '');

export function ExcelGrid({ cells, sel, onSel, onBar, minRows = 40, afterClick, children, widths }: Props) {
  useEffect(() => {
    const c = cells.get(sel);
    const text =
      c?.f ??
      c?.editor?.value ??
      (typeof c?.v === 'string' || typeof c?.v === 'number' ? String(c.v) : '');
    onBar({ ref: sel, text });
  }, [sel, cells, onBar]);
  useEffect(() => () => onBar(null), [onBar]);

  let last = 0;
  for (const k of cells.keys()) last = Math.max(last, rowOf(k));
  const rows = Math.max(minRows, last + 16);
  const selRow = rowOf(sel);
  const selCol = colOf(sel);

  return (
    <div className="xl-ws" role="grid" aria-label="시트">
      <div
        className="xl-ws-grid"
        style={{
          gridTemplateRows: `repeat(${rows + 1}, var(--xl-row))`,
          gridTemplateColumns: `var(--xl-rowhead) ${XL_COLS.map((c) =>
            widths?.[c] ? `calc(var(--xl-col) * ${widths[c]})` : 'var(--xl-col)',
          ).join(' ')}`,
        }}
      >
        <span className="xl-h xl-h-corner" />
        {XL_COLS.map((c) => (
          <span key={c} className={`xl-h xl-h-col${selCol === c ? ' on' : ''}`}>
            {c}
          </span>
        ))}
        {Array.from({ length: rows }, (_, ri) => {
          const r = ri + 1;
          return [
            <span key={`h${r}`} className={`xl-h xl-h-row${selRow === r ? ' on' : ''}`}>
              {r}
            </span>,
            ...XL_COLS.map((col) => {
              const key = `${col}${r}`;
              const c = cells.get(key);
              const cls = `xl-cell${c?.cls ? ` ${c.cls}` : ''}${key === sel ? ' sel' : ''}${
                c?.onClick ? ' clickable' : ''
              }`;
              const ed = c?.editor;
              if (ed)
                return (
                  <label key={key} className={`${cls} xl-editor`} onClick={() => onSel(key)}>
                    <input
                      ref={ed.inputRef}
                      className={`xl-edit${ed.align === 'left' ? ' left' : ''}`}
                      value={ed.value}
                      placeholder={ed.placeholder}
                      readOnly={ed.readOnly}
                      aria-busy={ed.readOnly || undefined}
                      inputMode={ed.inputMode ?? 'text'}
                      enterKeyHint="done"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={ed.maxLength}
                      aria-label={ed.label}
                      onFocus={() => onSel(key)}
                      onBlur={ed.onBlur}
                      onChange={(e) => {
                        onSel(key);
                        ed.onChange(e.target.value, (e.nativeEvent as InputEvent).isComposing ?? false);
                      }}
                      onCompositionEnd={(e) => ed.onChange(e.currentTarget.value, false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          ed.onEnter?.();
                        }
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
                    onSel(key);
                    c?.onClick?.();
                    afterClick?.();
                  }}
                >
                  {c?.v}
                </span>
              );
            }),
          ];
        })}
      </div>
      {children}
    </div>
  );
}
