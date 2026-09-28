import type { ReactNode, RefObject } from 'react';

/** 엑셀 위장 테마 공용 — 셀 정의·열 이름·시트 이름 저장. (컴포넌트 파일과 분리: fast refresh) */

export const XL_COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type XlSection = 'solo' | 'multi' | 'kbo';

/** 셀 안 편집기(input). */
export interface XlEditor {
  value: string;
  onChange: (value: string, composing: boolean) => void;
  onEnter?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  maxLength?: number;
  inputMode?: 'numeric' | 'text';
  align?: 'left' | 'right';
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
}

export interface XlCell {
  v?: ReactNode;
  /** 수식 입력줄에 보일 값(없으면 v가 문자열·숫자일 때 그대로). */
  f?: string;
  cls?: string;
  onClick?: () => void;
  editor?: XlEditor;
}

export type XlCells = Map<string, XlCell>;

export type XlBar = { ref: string; text: string } | null;

// ---------- 시트 이름(하단 탭) — 사용자가 바꿀 수 있고 기기에 저장 ----------
const SHEETS_KEY = 'nb_xl_sheets';
export const DEFAULT_SHEET_NAMES: Record<XlSection, string> = {
  solo: '매출현황',
  multi: '협업일정',
  kbo: '거래처',
};

export function loadSheetNames(): Record<XlSection, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SHEETS_KEY) ?? '{}') as Partial<Record<XlSection, unknown>>;
    const out = { ...DEFAULT_SHEET_NAMES };
    for (const k of Object.keys(out) as XlSection[]) {
      const v = raw[k];
      if (typeof v === 'string' && isValidSheetName(v)) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_SHEET_NAMES };
  }
}

export function saveSheetNames(names: Record<XlSection, string>) {
  try {
    localStorage.setItem(SHEETS_KEY, JSON.stringify(names));
  } catch {
    /* 저장 불가 무시 */
  }
}

/** 엑셀과 같은 규칙: 비어 있으면 안 되고 31자 이하, : \ / ? * [ ] 금지. */
export function isValidSheetName(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n.length <= 31 && !/[:\\/?*[\]]/.test(n);
}

/** 엑셀 테마 토스트 문구 — 이모지를 걷어내 업무 알림처럼(메시지 표시줄). */
export function xlPlain(msg: string): string {
  return msg
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|\u{20E3}/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
