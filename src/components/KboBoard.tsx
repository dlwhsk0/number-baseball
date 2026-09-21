import { useEffect, useState, type CSSProperties } from 'react';
import { fetchLeaderboard } from '../net/ranked';
import { getPlayerId } from '../net/fan';
import { teamById } from '../game/teams';
import type { Leaderboard as Board } from '../net/protocol';
import { TeamChip } from './TeamChip';

type Tab = 'team' | 'player' | 'versus';
const TABS: { id: Tab; label: string }[] = [
  { id: 'team', label: '구단' },
  { id: 'player', label: '개인' },
  { id: 'versus', label: '구단 대결' },
];

const fmt = (n: number) => n.toLocaleString('ko-KR');
const pct = (p: number) => p.toFixed(3).replace(/^0/, '');

interface Props {
  /** 내 응원 구단(강조 표시). */
  myTeam: string | null;
  /** 내 닉네임(순위표에 쓰이는 이름 — 비어 있으면 서버가 '플레이어'로 기록한다). */
  nick: string;
  /** 응원 구단 고르기/바꾸기 시트 열기. */
  onPickTeam: () => void;
}

/** KBO 탭 — 팬 순위(구단 솔로 누적 · 개인 누적 · 구단 대결). 탭에 들어올 때마다 새로 불러온다. */
export function KboBoard({ myTeam, nick, onPickTeam }: Props) {
  const [tab, setTab] = useState<Tab>('team');
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

  const maxTeamPts = Math.max(1, ...(data?.team.map((t) => t.points) ?? [1]));
  // 내 구단의 현재 순위(솔로 누적·구단 대결) — 맨 위 카드에 요약.
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
              {/* 순위표에 뜨는 이름 — 안 정하면 '플레이어'로 나간다는 걸 여기서 바로 보여준다. */}
              <span className="kbo-me-nickrow">
                <span className="kbo-me-label">닉네임</span>
                <span className={`kbo-me-nick${nick ? '' : ' none'}`}>
                  {nick || '플레이어 · 탭해서 설정'}
                </span>
              </span>
              <span className="kbo-me-ranks">
                <span className="kbo-me-rank">
                  <span className="kbo-me-label">구단 순위</span>
                  <b>{mySolo ? `${soloIdx + 1}위` : '-'}</b>
                  <span className="kbo-me-detail">{mySolo ? `${fmt(mySolo.points)}점` : '기록 없음'}</span>
                </span>
                <span className="kbo-me-rank">
                  <span className="kbo-me-label">구단 대결</span>
                  <b>{myVs && myVs.w + myVs.l + myVs.d > 0 ? `${vsIdx + 1}위` : '-'}</b>
                  <span className="kbo-me-detail">
                    {myVs && myVs.w + myVs.l + myVs.d > 0 ? `${myVs.w}승 ${myVs.l}패 ${myVs.d}무` : '기록 없음'}
                  </span>
                </span>
                <span className="kbo-me-rank">
                  <span className="kbo-me-label">내 순위</span>
                  <b>{data?.me ? `${data.me.rank}위` : '-'}</b>
                  <span className="kbo-me-detail">{data?.me ? `${fmt(data.me.points)}점` : '기록 없음'}</span>
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
          ) : tab === 'team' ? (
            <>
              <p className="board-caption">솔로 랭킹전 누적 점수 · 적게 시도할수록 높은 점수</p>
              <ol className="board-list">
                {data.team.map((t, i) => (
                  <li
                    key={t.team}
                    className={`board-row${t.team === myTeam ? ' me' : ''}`}
                    // 막대 색은 color(대표색)가 아니라 accent(다크에서 선명한 구단색).
                    style={{ '--team': teamById(t.team)?.accent } as CSSProperties}
                  >
                    <span className="board-rank">{i + 1}</span>
                    <span className="board-name">
                      <TeamChip team={t.team} />
                      {t.points > 0 && (
                        <span className="board-track">
                          <span
                            className="board-bar"
                            style={{ width: `${(t.points / maxTeamPts) * 100}%` }}
                          />
                        </span>
                      )}
                    </span>
                    <span className="board-num">{fmt(t.points)}</span>
                    <span className="board-sub">
                      {t.fans}명 · {t.games}판
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : tab === 'player' ? (
            <>
              <p className="board-caption">개인 누적 점수 TOP 50</p>
              {data.players.length === 0 ? (
                <p className="board-empty">아직 기록이 없어요. 첫 1위의 주인공이 되어보세요!</p>
              ) : (
                <ol className="board-list">
                  {data.players.map((p) => (
                    <li key={p.rank} className={`board-row${p.me ? ' me' : ''}`}>
                      <span className="board-rank">{p.rank}</span>
                      <span className="board-name">
                        <TeamChip team={p.team} />
                        <span className="board-nick">{p.nick}</span>
                      </span>
                      <span className="board-num">{fmt(p.points)}</span>
                      <span className="board-sub">{p.games}판</span>
                    </li>
                  ))}
                </ol>
              )}
              {data.me && !data.players.some((p) => p.me) && (
                <div className="board-row me board-mine">
                  <span className="board-rank">{data.me.rank}</span>
                  <span className="board-name">
                    <TeamChip team={data.me.team} />
                    <span className="board-nick">{data.me.nick} (나)</span>
                  </span>
                  <span className="board-num">{fmt(data.me.points)}</span>
                  <span className="board-sub">{data.me.games}판</span>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="board-caption">온라인 대전 구단 간 승패 · 다른 구단 팬을 이기면 1승</p>
              <table className="board-table">
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
                      <td>{i + 1}</td>
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
            </>
          )}
        </div>

      </div>
    </section>
  );
}
