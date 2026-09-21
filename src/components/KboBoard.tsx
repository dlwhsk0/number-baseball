import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../net/ranked';
import { getPlayerId } from '../net/fan';
import type { Leaderboard as Board, PlayerRow } from '../net/protocol';
import { TeamChip } from './TeamChip';
import { tieRanks, tierOf, TIERS, PLACEMENT_GAMES } from '../game/ranking';

type Tab = 'solo' | 'versus' | 'player';
const TABS: { id: Tab; label: string }[] = [
  { id: 'solo', label: '솔로' },
  { id: 'versus', label: '대결' },
  { id: 'player', label: '개인' },
];

const fmt = (n: number) => n.toLocaleString('ko-KR');
const pct = (p: number) => p.toFixed(3).replace(/^0/, '');
/** 평균 점수 표기 — 순위 비교와 같은 소수 둘째 자리(9.4와 9.43이 다른 순위로 보이지 않게). */
const avgFmt = (a: number) => a.toFixed(2);
/**
 * 두 표([솔로]·[대결]) 공용 칼럼 폭 — 순위·구단 고정 + 숫자 5칸 균등(table-layout: fixed).
 * 표마다 내용에 맞춰 폭이 잡히면 탭을 오갈 때 칼럼이 들썩여 깜빡이는 것처럼 보인다.
 */
function Cols() {
  return (
    <colgroup>
      <col className="col-rank" />
      <col className="col-team" />
      <col />
      <col />
      <col />
      <col />
      <col />
    </colgroup>
  );
}

/** 가을야구 — KBO는 5위까지 포스트시즌(공동 5위 포함). */
const POSTSEASON = 5;

/** 평균 점수 등급 배지(루키~MVP). */
function TierBadge({ avg, big = false }: { avg: number; big?: boolean }) {
  const t = tierOf(avg);
  return <span className={`tier tier-${t.id}${big ? ' big' : ''}`}>{t.name}</span>;
}

/**
 * 개인 탭 맨 위 '내 기록' — 배치고사 진행도 / 등급·평균·순위 + 다음 목표(다음 순위·다음 등급까지).
 * 순위표만 있으면 '나랑 상관없는 목록'이라 동기가 안 생긴다 → 내가 뭘 하면 올라가는지를 보여준다.
 */
function MyStat({ me, nick, onEdit }: { me: PlayerRow | null; nick: string; onEdit: () => void }) {
  const nickLine = (
    <button type="button" className="my-stat-nick" onClick={onEdit}>
      {nick ? <b>{nick}</b> : <span className="none">닉네임 정하기</span>}
      <span className="kbo-me-edit">변경</span>
    </button>
  );
  if (!me) {
    return (
      <div className="my-stat">
        {nickLine}
        <p className="my-stat-empty">아직 랭킹전 기록이 없어요. 솔로에서 첫 판을 던져보세요!</p>
      </div>
    );
  }
  if (me.rank == null) {
    // 배치고사 — 10칸 중 채운 만큼 점등(전광판 전구).
    return (
      <div className="my-stat">
        {nickLine}
        <div className="my-stat-main">
          <span className="tier placement">배치고사</span>
          <span className="my-stat-big">
            {me.games}
            <small>/{PLACEMENT_GAMES}판</small>
          </span>
        </div>
        <span className="placement-pips" aria-hidden="true">
          {Array.from({ length: PLACEMENT_GAMES }, (_, i) => (
            <i key={i} className={i < me.games ? 'on' : ''} />
          ))}
        </span>
        <p className="my-stat-goal">
          지금 평균 <b>{avgFmt(me.avg)}점</b> · {PLACEMENT_GAMES - me.games}판 더 하면 순위에 올라가요
        </p>
      </div>
    );
  }
  const next = TIERS[TIERS.findIndex((t) => t.id === tierOf(me.avg).id) - 1];
  return (
    <div className="my-stat">
      {nickLine}
      <div className="my-stat-main">
        <TierBadge avg={me.avg} big />
        <span className="my-stat-big">
          {avgFmt(me.avg)}
          <small>점</small>
        </span>
        <span className="my-stat-rank">
          <b className={me.rank <= POSTSEASON ? 'ps' : undefined}>{me.rank}위</b>
          <small>{me.games}판</small>
        </span>
      </div>
      <p className="my-stat-goal">
        {me.aboveAvg != null ? (
          <>
            다음 순위까지 <b>+{avgFmt(me.aboveAvg - me.avg)}점</b>
          </>
        ) : (
          <b>1위! 🏆</b>
        )}
        {next && (
          <>
            {' '}
            · {next.name}까지 <b>+{avgFmt(next.min - me.avg)}점</b>
          </>
        )}
      </p>
    </div>
  );
}

/** 개인 순위 한 줄. */
function PlayerLine({ p, mine = false }: { p: PlayerRow; mine?: boolean }) {
  return (
    <>
      <span className={`board-rank${p.rank != null && p.rank <= POSTSEASON ? ' ps' : ''}`}>
        {p.rank ?? '-'}
      </span>
      <span className="board-name">
        <TeamChip team={p.team} />
        <span className="board-nick">
          {p.nick}
          {mine && ' (나)'}
        </span>
        <TierBadge avg={p.avg} />
      </span>
      <span className="board-num">{avgFmt(p.avg)}</span>
      <span className="board-sub">{p.games}판</span>
    </>
  );
}

interface Props {
  /** 내 응원 구단(강조 표시). */
  myTeam: string | null;
  /** 내 닉네임(개인 순위에 쓰이는 이름 — 비어 있으면 서버가 '플레이어'로 기록). */
  nick: string;
  /** 응원 구단 고르기/바꾸기 시트 열기. */
  onPickTeam: () => void;
}

/** KBO 탭 — 구단 순위(솔로 랭킹전 누적 · 온라인 구단 대결) + 개인 순위(평균 점수). 탭에 들어올 때마다 새로 불러온다. */
export function KboBoard({ myTeam, nick, onPickTeam }: Props) {
  const [tab, setTab] = useState<Tab>('solo');
  const [data, setData] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // 개인 순위는 평균 점수(avg) 기준 — avg가 없는 응답(배포 순간 아직 옛 서버)은 개인 기록이 없는 것으로 본다.
  const me = data?.me && typeof data.me.avg === 'number' ? data.me : null;
  const players = data?.players.filter((p) => typeof p.avg === 'number') ?? [];

  // 내 구단의 현재 순위(솔로 누적·구단 대결) — 맨 위 카드에 요약.
  // 동점이면 같은 순위(1, 1, 3…) — 구단은 점수, 구단 대결은 승률 기준.
  const teamRanks = data ? tieRanks(data.team, (t) => t.points) : [];
  const vsRanks = data ? tieRanks(data.versus, (v) => v.pct) : [];
  const soloIdx = data?.team.findIndex((t) => t.team === myTeam) ?? -1;
  // 아직 판이 없는 구단은 순위를 매기지 않는다(0점 동점 정렬 순서일 뿐).
  const mySolo = soloIdx >= 0 && data && data.team[soloIdx].games > 0 ? data.team[soloIdx] : undefined;
  const vsIdx = data?.versus.findIndex((v) => v.team === myTeam) ?? -1;
  const myVs = vsIdx >= 0 ? data?.versus[vsIdx] : undefined;

  return (
    <section className="kbo-view">
      <div className="kbo-card">
        <button type="button" className="kbo-me" onClick={onPickTeam}>
          {myTeam ? (
            <>
              <span className="kbo-me-main">
                <TeamChip team={myTeam} withName />
                <span className="kbo-me-edit">변경</span>
              </span>
              <span className="kbo-me-ranks">
                <span className="kbo-me-rank">
                  <span className="kbo-me-label">솔로 순위</span>
                  <b>{mySolo ? `${teamRanks[soloIdx]}위` : '-'}</b>
                  <span className="kbo-me-detail">{mySolo ? `${fmt(mySolo.points)}점` : '기록 없음'}</span>
                </span>
                <span className="kbo-me-rank">
                  <span className="kbo-me-label">대결 순위</span>
                  <b>{myVs && myVs.w + myVs.l + myVs.d > 0 ? `${vsRanks[vsIdx]}위` : '-'}</b>
                  <span className="kbo-me-detail">
                    {myVs && myVs.w + myVs.l + myVs.d > 0 ? `${myVs.w}승 ${myVs.l}패 ${myVs.d}무` : '기록 없음'}
                  </span>
                </span>
                <span className="kbo-me-rank">
                  <span className="kbo-me-label">내 순위</span>
                  <b>{me ? (me.rank != null ? `${me.rank}위` : '배치') : '-'}</b>
                  <span className="kbo-me-detail">
                    {me
                      ? me.rank != null
                        ? `평균 ${avgFmt(me.avg)}점`
                        : `${me.games}/${PLACEMENT_GAMES}판`
                      : '기록 없음'}
                  </span>
                </span>
              </span>
            </>
          ) : (
            <span className="fan-team-none">⚾ 응원 구단 고르기</span>
          )}
        </button>

        <div className="seg board-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`seg-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="board-body">
          {error ? (
            <p className="board-empty">{error}</p>
          ) : !data ? (
            <p className="board-empty">불러오는 중…</p>
          ) : tab === 'solo' ? (
            <>
              <p className="board-caption">솔로 랭킹전 누적 점수 · 적게 시도할수록 높은 점수</p>
              {/* KBO 팀 순위표처럼 숫자로 — 막대는 구단 테마 색과 겹쳐 오히려 안 읽혔다. */}
              <table className="board-table">
                <Cols />
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>구단</th>
                    <th>점수</th>
                    <th>판</th>
                    <th>성공</th>
                    <th>평균</th>
                    <th>팬</th>
                  </tr>
                </thead>
                <tbody>
                  {data.team.map((t, i) => (
                    <tr key={t.team} className={t.team === myTeam ? 'me' : ''}>
                      {/* 판이 없는 구단은 0점 동점 정렬일 뿐이라 순위를 매기지 않는다. */}
                      <td className={t.games > 0 && teamRanks[i] <= POSTSEASON ? 'ps' : undefined}>
                        {t.games > 0 ? teamRanks[i] : '-'}
                      </td>
                      <td>
                        <TeamChip team={t.team} />
                      </td>
                      <td className="board-strong">{fmt(t.points)}</td>
                      <td>{t.games}</td>
                      <td>{t.wins}</td>
                      <td>{t.avgAttempts != null ? t.avgAttempts.toFixed(1) : '-'}</td>
                      <td>{t.fans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="board-foot">성공 = 맞힌 판 · 평균 = 맞힌 판의 평균 시도</p>
            </>
          ) : tab === 'player' ? (
            <>
              <MyStat me={me} nick={nick} onEdit={onPickTeam} />
              <p className="board-caption">
                한 판 평균 점수 · {PLACEMENT_GAMES}판 이상 · TOP 50
              </p>
              {players.length === 0 ? (
                <p className="board-empty">아직 순위에 오른 사람이 없어요. 첫 1위의 주인공이 되어보세요!</p>
              ) : (
                <ol className="board-list">
                  {players.map((p, i) => (
                    <li key={i} className={`board-row${p.me ? ' me' : ''}`}>
                      <PlayerLine p={p} mine={p.me} />
                    </li>
                  ))}
                </ol>
              )}
              {me?.rank != null && !players.some((p) => p.me) && (
                <div className="board-row me board-mine">
                  <PlayerLine p={me} mine />
                </div>
              )}
              <p className="board-foot">
                {TIERS.filter((t) => t.min > 0)
                  .map((t) => `${t.name} ${t.min}+`)
                  .join(' · ')}{' '}
                · 실패한 판은 0점으로 평균에 들어가요
              </p>
            </>
          ) : (
            <>
              <p className="board-caption">온라인 대전 구단 간 승패 · 다른 구단 팬을 이기면 1승</p>
              <table className="board-table">
                <Cols />
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>구단</th>
                    <th>승</th>
                    <th>패</th>
                    <th>무</th>
                    <th>승률</th>
                    <th>차</th>
                  </tr>
                </thead>
                <tbody>
                  {data.versus.map((v, i) => (
                    <tr key={v.team} className={v.team === myTeam ? 'me' : ''}>
                      <td className={v.w + v.l + v.d > 0 && vsRanks[i] <= POSTSEASON ? 'ps' : undefined}>
                        {v.w + v.l + v.d > 0 ? vsRanks[i] : '-'}
                      </td>
                      <td>
                        <TeamChip team={v.team} />
                      </td>
                      <td>{v.w}</td>
                      <td>{v.l}</td>
                      <td>{v.d}</td>
                      <td>{pct(v.pct)}</td>
                      <td>{v.w + v.l + v.d === 0 || v.gb === 0 ? '-' : v.gb.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="board-foot">승률 = 승 ÷ (승+패) · 차 = 1위와의 게임차</p>
            </>
          )}
        </div>

      </div>
    </section>
  );
}
