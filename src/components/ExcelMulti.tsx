import { useMemo, useState } from 'react';
import { teamById } from '../game/teams';
import { ExcelGrid } from './ExcelGrid';
import type { XlBar, XlCell } from './excel';

/**
 * 엑셀 위장 테마의 멀티 시작 메뉴('협업일정' 시트) — App의 멀티 메뉴 카드를 셀 양식으로.
 * 값·동작은 전부 App이 쥐고 있고(닉네임·자릿수·종류·코드·방 만들기…), 여기선 셀로 배치만 한다.
 * 방에 들어간 뒤의 대전 화면은 기존 컴포넌트(OnlineDuel 등)가 그대로 맡는다.
 */
type GameType = 'speed' | 'duel';

interface Props {
  nick: string;
  onNick: (v: string) => void;
  /** 닉네임 확정(서버 중복 확인) — 칸을 벗어날 때. */
  onNickCommit: () => void;
  nickChecking: boolean;
  team: string | null;
  onPickTeam: () => void;
  digits: number;
  onDigits: (d: number) => void;
  gameType: GameType;
  onGameType: (t: GameType) => void;
  online: boolean;
  onRandom: () => void;
  onCreate: () => void;
  code: string;
  onCode: (v: string, composing: boolean) => void;
  onJoin: () => void;
  peeking: boolean;
  onLocal: () => void;
  onSelect: (bar: XlBar) => void;
}

export function ExcelMulti(p: Props) {
  const [sel, setSel] = useState('B3');

  const cells = useMemo(() => {
    const m = new Map<string, XlCell>();
    const put = (key: string, c: XlCell) => m.set(key, c);
    const off = p.online ? '' : ' xl-disabled';

    put('A1', { v: '협업 일정 등록', cls: 'xl-title-cell' });
    put('A3', { v: '닉네임', cls: 'xl-head-cell' });
    put('B3', {
      editor: {
        value: p.nick,
        onChange: (v) => p.onNick(v),
        onBlur: p.onNickCommit,
        // Enter는 칸을 벗어나게만 — 확인은 blur 한 번(두 번 요청 안 가게).
        onEnter: () => (document.activeElement as HTMLElement | null)?.blur(),
        readOnly: p.nickChecking,
        placeholder: p.nickChecking ? '확인 중…' : '비워두면 자동',
        maxLength: 12,
        align: 'left',
        label: '닉네임',
      },
      cls: 'xl-span',
    });
    put('A4', { v: '소속', cls: 'xl-head-cell' });
    put('B4', {
      v: p.team ? (teamById(p.team)?.name ?? p.team) : '구단 고르기',
      cls: 'xl-link',
      onClick: p.onPickTeam,
    });
    if (p.team)
      put('A5', { v: '※ 같은 소속끼리 진행한 건은 소속 실적에 반영되지 않습니다.', cls: 'xl-muted xl-small' });

    put('A6', { v: '자릿수', cls: 'xl-head-cell' });
    [3, 4].forEach((d, i) =>
      put(`${'BC'[i]}6`, {
        v: `${d}자리`,
        cls: `xl-c xl-opt${p.digits === d ? ' on' : ''}`,
        onClick: () => p.onDigits(d),
      }),
    );
    put('A7', { v: '종류', cls: 'xl-head-cell' });
    put('B7', {
      v: '스피드',
      cls: `xl-c xl-opt${p.gameType === 'speed' ? ' on' : ''}`,
      onClick: () => p.onGameType('speed'),
    });
    put('C7', {
      v: '주고받기',
      cls: `xl-c xl-opt${p.gameType === 'duel' ? ' on' : ''}`,
      onClick: () => p.onGameType('duel'),
    });
    put('A8', {
      v:
        p.gameType === 'speed'
          ? '여럿이 같은 숫자를 동시에 풀어요. 적은 횟수로 먼저 맞히면 승리 (2~6명)'
          : '서로 상대가 맞힐 숫자를 정하고 번갈아 맞혀요. 먼저 맞히면 승리 (1:1)',
      cls: 'xl-muted xl-small',
    });

    let r = 10;
    if (p.gameType === 'duel') {
      put(`A${r}`, { v: '▶ 랜덤 매치', cls: `xl-link${off}`, onClick: p.onRandom });
      put(`C${r}`, { v: '같은 자릿수 상대와 자동 연결', cls: 'xl-muted xl-small' });
      r++;
    }
    put(`A${r}`, { v: '▶ 방 만들기', cls: `xl-link${off}`, onClick: p.onCreate });
    put(`C${r}`, { v: '코드를 받아 초대', cls: 'xl-muted xl-small' });
    r += 2;
    put(`A${r}`, { v: '코드', cls: 'xl-head-cell' });
    put(`B${r}`, {
      editor: {
        value: p.code,
        onChange: p.onCode,
        onEnter: p.onJoin,
        placeholder: 'CODE',
        maxLength: 12,
        align: 'left',
        label: '방 코드',
      },
    });
    put(`C${r}`, {
      v: p.peeking ? '확인 중…' : '▶ 코드로 입장',
      cls: `xl-link${p.online && !p.peeking ? '' : ' xl-disabled'}`,
      onClick: p.onJoin,
    });
    r += 2;
    put(`A${r}`, { v: '▶ 오프라인으로 하기', cls: 'xl-link', onClick: p.onLocal });
    put(`C${r}`, { v: '한 기기로 번갈아', cls: 'xl-muted xl-small' });
    if (!p.online) put(`A${r + 2}`, { v: '오프라인 — 온라인 항목은 네트워크 연결이 필요합니다.', cls: 'xl-muted xl-small' });
    return m;
  }, [p]);

  return <ExcelGrid cells={cells} sel={sel} onSel={setSel} onBar={p.onSelect} />;
}
