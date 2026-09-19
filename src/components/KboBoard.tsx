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
  onClose: () => void;
  /** 내 응원 구단(강조 표시). */
  myTeam: string | null;
  initialTab?: Tab;
}

/** 팬 순위표 — 구단 솔로 누적 · 개인 누적 · 구단 대결(멀티) 승률. */
export function Leaderboard({ onClose, myTeam, initialTab = 'team' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const maxTeamPts = Math.max(1, ...(data?.team.map((t) => t.points) ?? [1]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-sheet board-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="팬 순위"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="settings-title">🏆 팬 순위</h3>
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
                    style={{ '--team': teamById(t.team)?.color } as CSSProperties}
                  >
                    <span className="board-rank">{i + 1}</span>
                    <span className="board-name">
                      <TeamChip team={t.team} />
                      {t.points > 0 && (
                        <span className="board-bar" style={{ width: `${(t.points / maxTeamPts) * 100}%` }} />
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

        <button type="button" className="settings-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
