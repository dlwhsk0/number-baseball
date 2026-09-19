import { useState, type CSSProperties } from 'react';
import { TEAMS } from '../game/teams';

interface Props {
  nick: string;
  team: string | null;
  /** 시트 상단 설명(상황별 — 랭킹전 시작/멀티 등). */
  message?: string;
  onSave: (nick: string, team: string) => void;
  onClose: () => void;
}

/** 팬 등록 시트 — 닉네임 + 응원 구단(KBO 10개 구단). 랭킹·구단 대결 기록에 쓰인다. */
export function TeamPicker({ nick, team, message, onSave, onClose }: Props) {
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
        <h3 className="settings-title">⚾ 응원 구단</h3>
        <p className="settings-desc fan-desc">
          {message ?? '고른 구단으로 점수가 쌓여요. 우리 팀을 1위로!'}
        </p>

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
          닫기
        </button>
      </div>
    </div>
  );
}
