import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 시작 인트로 — 전광판이 켜지는 연출(세그먼트 플리커)로 타이틀을 잠깐 띄운다.
 * 세션당 1회만(App에서 sessionStorage로 제어). ~1.8초 후 자동으로, 또는 탭하면 즉시 닫힌다.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    setTimeout(onDone, 320); // 페이드아웃 후 제거
  }, [onDone]);

  useEffect(() => {
    const t = setTimeout(finish, 1800);
    return () => clearTimeout(t);
  }, [finish]);

  return (
    <div
      className={`intro${leaving ? ' leaving' : ''}`}
      onClick={finish}
      role="button"
      aria-label="시작하기"
    >
      <div className="intro-inner">
        <h1 className="intro-title">
          숫자 야구 <span className="intro-ball">⚾</span>
        </h1>
        <p className="intro-sub">서로 다른 숫자를 맞혀보세요</p>
        <p className="intro-tap">탭하여 시작</p>
      </div>
    </div>
  );
}
