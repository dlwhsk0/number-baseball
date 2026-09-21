import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../net/ranked';
import { getPlayerId } from '../net/fan';
import type { Leaderboard as Board } from '../net/protocol';
import { TeamChip } from './TeamChip';
import { tieRanks } from '../game/ranking';

// 개인 순위(누적 합계)는 판 수 싸움이라 심심해서 잠시 숨김 — 서버는 계속 players를 내려준다.
type Tab = 'solo' | 'versus';
const TABS: { id: Tab; label: string }[] = [
  { id: 'solo', label: '솔로' },
  { id: 'versus', label: '대결' },
];

const fmt = (n: number) => n.toLocaleString('ko-KR');
const pct = (p: number) => p.toFixed(3).replace(/^0/, '');
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

interface Props {
  /** 내 응원 구단(강조 표시). */
  myTeam: string | null;
  /** 응원 구단 고르기/바꾸기 시트 열기. */
  onPickTeam: () => void;
}

/** KBO 탭 — 구단 순위(솔로 랭킹전 누적 · 온라인 구단 대결). 탭에 들어올 때마다 새로 불러온다. */
export function KboBoard({ myTeam, onPickTeam }: Props) {
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
