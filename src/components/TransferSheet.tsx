import { useEffect, useState } from 'react';
import { createTransfer, redeemTransfer } from '../net/ranked';
import { getPlayerId } from '../net/fan';

const CODE_LEN = 6;

interface Props {
  /** 코드 입력 성공 — 받은 옛 기기의 신원(App이 저장 후 새로고침). */
  onDone: (r: { playerId: string; nick: string; team: string }) => void;
  onClose: () => void;
}

/**
 * 기기 옮기기 — 로그인이 없어 기록이 기기(localStorage id)에 묶여 있으니, 옛 기기에서 받은 1회용 코드를
 * 새 기기에 입력해 같은 id를 쓰게 한다. 새 기기에 쌓인 기록은 옛 기기 쪽으로 합쳐진다.
 */
export function TransferSheet({ onDone, onClose }: Props) {
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [input, setInput] = useState('');

  const left = issued ? Math.max(0, Math.ceil((issued.expiresAt - now) / 1000)) : 0;
  useEffect(() => {
    if (!issued) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [issued]);

  const switchMode = (m: 'send' | 'receive') => {
    setMode(m);
    setError(null);
  };

  const issue = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await createTransfer(getPlayerId());
    setBusy(false);
    if (r.ok && r.code && r.expiresAt) {
      setNow(Date.now());
      setIssued({ code: r.code, expiresAt: r.expiresAt });
    } else setError(r.error ?? '코드를 만들지 못했어요.');
  };

  const redeem = async () => {
    if (busy || input.length !== CODE_LEN) return;
    setBusy(true);
    setError(null);
    const r = await redeemTransfer(input, getPlayerId());
    setBusy(false);
    if (r.ok && r.playerId && r.nick && r.team) onDone({ playerId: r.playerId, nick: r.nick, team: r.team });
    else setError(r.error ?? '기록을 옮기지 못했어요.');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-sheet transfer-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="기기 옮기기"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="settings-title">📲 기기 옮기기</h3>
        <p className="settings-desc">
          기록은 기기에 저장돼요. 새 폰이나 홈 화면 앱으로 옮길 땐 원래 기기에서 코드를 받아 새 기기에 입력하세요.
        </p>

        <div className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'send'}
            className={`seg-btn${mode === 'send' ? ' active' : ''}`}
            onClick={() => switchMode('send')}
          >
            코드 받기
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'receive'}
            className={`seg-btn${mode === 'receive' ? ' active' : ''}`}
            onClick={() => switchMode('receive')}
          >
            코드 입력
          </button>
        </div>

        {mode === 'send' ? (
          <>
            <p className="transfer-step">원래 쓰던 기기라면 — 코드를 받아 새 기기에 입력하세요.</p>
            {issued && left > 0 ? (
              <div className="transfer-code-box">
                <span className="transfer-code" aria-label={`코드 ${issued.code.split('').join(' ')}`}>
                  {issued.code}
                </span>
                <span className="transfer-left">
                  {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} 동안 · 한 번만 쓸 수 있어요
                </span>
              </div>
            ) : (
              <button
                type="button"
                className={`versus-primary${busy ? ' disabled' : ''}`}
                aria-disabled={busy}
                onClick={issue}
              >
                {busy ? '만드는 중…' : issued ? '코드 다시 받기' : '코드 받기'}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="transfer-step">새 기기라면 — 원래 기기에서 받은 코드를 입력하세요.</p>
            <input
              className="online-input transfer-input"
              value={input}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={CODE_LEN}
              placeholder="ABC234"
              aria-label="옮기기 코드"
              onChange={(e) => {
                setInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN));
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && redeem()}
            />
            <p className="settings-desc transfer-warn">
              이 기기에서 한 기록은 원래 기록에 합쳐지고, 닉네임·응원 구단은 원래 기기 것으로 바뀌어요.
            </p>
            <button
              type="button"
              className={`versus-primary${busy || input.length !== CODE_LEN ? ' disabled' : ''}`}
              aria-disabled={busy || input.length !== CODE_LEN}
              onClick={redeem}
            >
              {busy ? '옮기는 중…' : '기록 가져오기'}
            </button>
          </>
        )}

        {error && (
          <p className="transfer-error" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="settings-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
