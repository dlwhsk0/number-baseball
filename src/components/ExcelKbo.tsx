import { useEffect, useMemo, useState } from 'react';
import { fetchLeaderboard } from '../net/ranked';
import { getPlayerId } from '../net/fan';
import type { Leaderboard } from '../net/protocol';
import { teamById } from '../game/teams';
import { tieRanks, tierOf, PLACEMENT_GAMES } from '../game/ranking';
import { ExcelGrid } from './ExcelGrid';
import { XL_COLS, type XlBar, type XlCell } from './excel';

/**
 * 엑셀 위장 테마의 KBO 탭('거래처' 시트) — KboBoard와 같은 데이터를 셀에 표로.
 *   1행 제목 · 2~6행 내 요약(담당자·소속·순위) · 8행 [솔로|대결|개인] 전환 셀 · 10행 머리글 · 11행부터 순위표.
 */

type Tab = 'solo' | 'versus' | 'player';
const TABS: { id: Tab; label: string }[] = [
  { id: 'solo', label: '솔로' },
  { id: 'versus', label: '대결' },
  { id: 'player', label: '개인' },
];
const POSTSEASON = 5;
const HEAD = 10;
const fmt = (n: number) => n.toLocaleString('ko-KR');
const pct = (p: number) => p.toFixed(3).replace(/^0/, '');
const avgFmt = (a: number) => a.toFixed(2);
const teamName = (id: string) => teamById(id)?.name ?? id;

interface Props {
  myTeam: string | null;
  nick: string;
  onPickTeam: () => void;
  onSelect: (bar: XlBar) => void;
}

export function ExcelKbo({ myTeam, nick, onPickTeam, onSelect }: Props) {
  const [tab, setTab] = useState<Tab>('solo');
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState('A1');

  useEffect(() => {
    let alive = true;
    fetchLeaderboard(getPlayerId()).then((r) => {
      if (!alive) return;
      if (r.ok && r.data) setData(r.data);
      else setError(r.error ?? '순위를 불러오지 못했어요.');
    });
    return () => {
      alive = false;
    };
  }, []);

  const cells = useMemo(() => {
    const m = new Map<string, XlCell>();
    const put = (key: string, c: XlCell) => m.set(key, c);
    const row = (r: number, vals: (string | number)[], cls = '', firstCls = '') =>
      vals.forEach((v, i) =>
        put(`${XL_COLS[i]}${r}`, { v, cls: `${i === 0 ? firstCls : typeof v === 'number' ? 'xl-r' : ''} ${cls}`.trim() }),
      );

    const me = data?.me && typeof data.me.avg === 'number' ? data.me : null;
    const players = data?.players.filter((p) => typeof p.avg === 'number') ?? [];
    const teamRanks = data ? tieRanks(data.team, (t) => t.points) : [];
    const vsRanks = data ? tieRanks(data.versus, (v) => v.pct) : [];
    const soloIdx = data?.team.findIndex((t) => t.team === myTeam) ?? -1;
    const mySolo = soloIdx >= 0 && data && data.team[soloIdx].games > 0 ? data.team[soloIdx] : undefined;
    const vsIdx = data?.versus.findIndex((v) => v.team === myTeam) ?? -1;
    const myVs = vsIdx >= 0 ? data?.versus[vsIdx] : undefined;
    const vsPlayed = myVs && myVs.w + myVs.l + myVs.d > 0;

    put('A1', { v: '거래처 현황', cls: 'xl-title-cell' });
    put('A2', { v: '담당자', cls: 'xl-head-cell' });
    put('B2', { v: nick || '닉네임 정하기', cls: 'xl-link', onClick: onPickTeam });
    put('A3', { v: '소속', cls: 'xl-head-cell' });
    put('B3', { v: myTeam ? teamName(myTeam) : '구단 고르기', cls: 'xl-link', onClick: onPickTeam });
    put('A4', { v: '솔로 순위', cls: 'xl-head-cell' });
    put('B4', { v: mySolo ? `${teamRanks[soloIdx]}위` : '-', cls: 'xl-r' });
    put('C4', { v: mySolo ? `${fmt(mySolo.points)}점` : '기록 없음', cls: 'xl-r xl-muted' });
    put('A5', { v: '대결 순위', cls: 'xl-head-cell' });
    put('B5', { v: vsPlayed ? `${vsRanks[vsIdx]}위` : '-', cls: 'xl-r' });
    put('C5', {
      v: vsPlayed && myVs ? `${myVs.w}승 ${myVs.l}패 ${myVs.d}무` : '기록 없음',
      cls: 'xl-r xl-muted',
    });
    put('A6', { v: '내 순위', cls: 'xl-head-cell' });
    put('B6', { v: me ? (me.rank != null ? `${me.rank}위` : '배치') : '-', cls: 'xl-r' });
    put('C6', {
      v: me ? (me.rank != null ? `평균 ${avgFmt(me.avg)}점` : `${me.games}/${PLACEMENT_GAMES}판`) : '기록 없음',
      cls: 'xl-r xl-muted',
    });
    if (me) put('D6', { v: tierOf(me.avg).name, cls: 'xl-c' });

    put('A8', { v: '구분', cls: 'xl-head-cell' });
    TABS.forEach((t, i) =>
      put(`${XL_COLS[i + 1]}8`, {
        v: t.label,
        cls: `xl-c xl-opt${tab === t.id ? ' on' : ''}`,
        onClick: () => setTab(t.id),
      }),
    );

    if (error || !data) {
      put(`A${HEAD + 1}`, { v: error ?? '불러오는 중…', cls: 'xl-muted xl-small' });
      return m;
    }

    let r = HEAD + 1;
    if (tab === 'solo') {
      put('A9', { v: '솔로 랭킹전 누적 점수 · 적게 시도할수록 높은 점수', cls: 'xl-muted xl-small' });
      row(HEAD, ['순위', '구단', '점수', '판', '성공', '평균', '팬'], 'xl-head-cell xl-c');
      data.team.forEach((t, i) => {
        const mine = t.team === myTeam ? ' xl-me' : '';
        const rank = t.games > 0 ? teamRanks[i] : '-';
        put(`A${r}`, { v: rank, cls: `xl-c${typeof rank === 'number' && rank <= POSTSEASON ? ' xl-ps' : ''}${mine}` });
        put(`B${r}`, { v: teamName(t.team), cls: mine.trim() });
        put(`C${r}`, { v: fmt(t.points), f: String(t.points), cls: `xl-r${mine}` });
        put(`D${r}`, { v: t.games, cls: `xl-r${mine}` });
        put(`E${r}`, { v: t.wins, cls: `xl-r${mine}` });
        put(`F${r}`, {
          v: t.avgAttempts != null ? t.avgAttempts.toFixed(1) : '-',
          f: t.avgAttempts != null ? `=AVERAGEIF(솔로!B:B,B${r},솔로!H:H)` : undefined,
          cls: `xl-r${mine}`,
        });
        put(`G${r}`, { v: t.fans, cls: `xl-r${mine}` });
        r++;
      });
      put(`A${r + 1}`, { v: '성공 = 맞힌 판 · 평균 = 맞힌 판의 평균 시도', cls: 'xl-muted xl-small' });
    } else if (tab === 'versus') {
      put('A9', { v: '온라인 대전 구단 간 승패 · 다른 구단 팬을 이기면 1승', cls: 'xl-muted xl-small' });
      row(HEAD, ['순위', '구단', '승', '패', '무', '승률', '차'], 'xl-head-cell xl-c');
      data.versus.forEach((v, i) => {
        const mine = v.team === myTeam ? ' xl-me' : '';
        const played = v.w + v.l + v.d > 0;
        put(`A${r}`, { v: played ? vsRanks[i] : '-', cls: `xl-c${played && vsRanks[i] <= POSTSEASON ? ' xl-ps' : ''}${mine}` });
        put(`B${r}`, { v: teamName(v.team), cls: mine.trim() });
        put(`C${r}`, { v: v.w, cls: `xl-r${mine}` });
        put(`D${r}`, { v: v.l, cls: `xl-r${mine}` });
        put(`E${r}`, { v: v.d, cls: `xl-r${mine}` });
        put(`F${r}`, { v: pct(v.pct), f: `=IFERROR(C${r}/(C${r}+D${r}),0)`, cls: `xl-r${mine}` });
        put(`G${r}`, { v: !played || v.gb === 0 ? '-' : v.gb.toFixed(1), cls: `xl-r${mine}` });
        r++;
      });
      put(`A${r + 1}`, { v: '승률 = 승 ÷ (승+패) · 차 = 1위와의 게임차', cls: 'xl-muted xl-small' });
    } else {
      put('A9', { v: `한 판 평균 점수 · ${PLACEMENT_GAMES}판 이상 · TOP 50`, cls: 'xl-muted xl-small' });
      row(HEAD, ['순위', '닉네임', '구단', '등급', '평균', '판'], 'xl-head-cell xl-c');
      const list = me?.rank != null && !players.some((p) => p.me) ? [...players, me] : players;
      if (list.length === 0) put(`A${r}`, { v: '아직 순위에 오른 사람이 없어요.', cls: 'xl-muted xl-small' });
      list.forEach((p) => {
        const mine = p.me ? ' xl-me' : '';
        put(`A${r}`, { v: p.rank ?? '-', cls: `xl-c${p.rank != null && p.rank <= POSTSEASON ? ' xl-ps' : ''}${mine}` });
        put(`B${r}`, { v: p.me ? `${p.nick} (나)` : p.nick, cls: mine.trim() });
        put(`C${r}`, { v: teamName(p.team), cls: mine.trim() });
        put(`D${r}`, { v: tierOf(p.avg).name, cls: `xl-c${mine}` });
        put(`E${r}`, { v: avgFmt(p.avg), cls: `xl-r${mine}` });
        put(`F${r}`, { v: p.games, cls: `xl-r${mine}` });
        r++;
      });
      put(`A${r + 1}`, { v: '실패한 판은 0점으로 평균에 들어가요', cls: 'xl-muted xl-small' });
    }
    return m;
  }, [data, error, tab, myTeam, nick, onPickTeam]);

  return <ExcelGrid cells={cells} sel={sel} onSel={setSel} onBar={onSelect} widths={{ B: 1.7 }} />;
}
