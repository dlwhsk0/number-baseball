import { useState, type CSSProperties } from 'react';
import { TEAMS } from '../game/teams';

interface Props {
  nick: string;
  team: string | null;
  /** 시트 상단 설명(상황별 — 랭킹전 시작/멀티 등). */
  message?: string;
  /** 첫 방문 온보딩 — 구단 대항전 소개를 위에 붙이고 닫기 대신 '나중에 할게요'. */
  intro?: boolean;
  onSave: (nick: string, team: string) => void;
  onClose: () => void;
}

/** 팬 등록 시트 — 닉네임 + 응원 구단(KBO 10개 구단). 랭킹·구단 대결 기록에 쓰인다. */
export function TeamPicker({ nick, team, message, intro = false, onSave, onClose }: Props) {
  const [name, setName] = useState(nick);
  const [pick, setPick] = useState<string | null>(team);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-sheet fan-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="응원 구단 선택"
        onClick={(e) => e.stopPropagation()}
      >
        {intro ? (
          <div className="fan-intro">
            <img className="fan-intro-kbo" src="/kbo-logo.png" alt="KBO" />
            <h3 className="settings-title">구단 대항전</h3>
            <p className="settings-desc fan-desc">응원 구단을 고르고, 우리 팀을 1위로 만들어요!</p>
            <ul className="fan-intro-list">
              <li>
                <span aria-hidden="true">🎯</span>
                <span>
                  <b>솔로 랭킹전</b> — 적게 시도할수록 높은 점수, 우리 구단 점수로 누적
                </span>
              </li>
              <li>
                <span aria-hidden="true">⚔️</span>
                <span>
                  <b>멀티</b> — 다른 구단 팬을 이기면 우리 구단 1승
                </span>
              </li>
              <li>
                <span aria-hidden="true">📊</span>
                <span>
                  <b>KBO 탭</b> — 구단 순위 · 내 순위 한눈에
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <>
            <h3 className="settings-title">⚾ 응원 구단</h3>
            <p className="settings-desc fan-desc">
              {message ?? '고른 구단으로 점수가 쌓여요. 우리 팀을 1위로!'}
            </p>
          </>
        )}

        <label className="versus-field">
          <span className="versus-label">닉네임</span>
          <input
            className="online-input"
            value={name}
            maxLength={12}
            placeholder="플레이어"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {/* 비워두면 placeholder 그대로 '플레이어'로 기록된다 — 순위표에서 남 이름처럼 보이는 걸 막는 안내. */}
        <p className="fan-nick-hint">
          {name.trim() ? '개인 순위에 이 이름으로 올라가요.' : "비워두면 '플레이어'로 올라가요."}
        </p>

        <div className="team-grid" role="radiogroup" aria-label="구단">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={pick === t.id}
              className={`team-pick${pick === t.id ? ' on' : ''}`}
              style={{ '--team': t.color } as CSSProperties}
              onClick={() => setPick(t.id)}
            >
              <img className="team-pick-logo" src={t.logo} alt="" draggable={false} />
              <span className="team-pick-name">{t.name}</span>
            </button>
          ))}
        </div>
        {team && pick !== team && (
          <p className="settings-desc fan-desc">
            구단을 바꾸면 이후 판부터 새 구단으로 쌓여요(지난 기록은 그대로).
          </p>
        )}

        <button
          type="button"
          className={`versus-primary${pick ? '' : ' disabled'}`}
          aria-disabled={!pick}
          onClick={() => pick && onSave(name.trim(), pick)}
        >
          이 구단 응원하기
        </button>
        <button type="button" className="settings-close" onClick={onClose}>
          {intro ? '나중에 할게요' : '닫기'}
        </button>
      </div>
    </div>
  );
}
