import { useState, type ReactNode } from 'react';
import { promptInstall, useInstallState } from '../pwa/install';

/**
 * 홈 화면 설치 안내. 튜토리얼 마지막 단계와 설정 시트가 같은 본문을 쓴다.
 * 안드로이드·데스크톱 크롬은 원탭 설치(beforeinstallprompt), iOS는 API가 없어 수동 안내.
 * 설치된 앱(standalone)에서는 호출부가 아예 안 그린다.
 */
const STEPS: Record<'ios' | 'android' | 'desktop', [string, ReactNode][]> = {
  ios: [
    ['⬆️', <>사파리 하단(또는 상단)의 <b>공유</b> 버튼(⬆︎)을 누르고</>],
    ['➕', <><b>홈 화면에 추가</b>를 고른 뒤</>],
    ['⚾', <>오른쪽 위 <b>추가</b>를 누르면 끝!</>],
  ],
  android: [
    ['⋮', <>브라우저 오른쪽 위 <b>⋮</b> 메뉴를 열고</>],
    ['➕', <><b>앱 설치</b>(또는 <b>홈 화면에 추가</b>)를 고르면 끝!</>],
  ],
  desktop: [
    ['⊕', <>주소창 오른쪽 끝의 <b>설치</b> 아이콘을 누르고</>],
    ['⚾', <><b>설치</b>를 누르면 창 하나로 띄울 수 있어요.</>],
  ],
};

export function InstallGuide() {
  const { platform, canPrompt } = useInstallState();
  // 프롬프트를 거절했거나 실패하면 그 자리에서 수동 안내로 넘어간다.
  const [fellBack, setFellBack] = useState(false);
  const [done, setDone] = useState(false);

  const tryInstall = async () => {
    const ok = await promptInstall();
    if (ok) setDone(true);
    else setFellBack(true);
  };

  return (
    <div className="install-guide">
      <p className="tut-lead">
        홈 화면에 설치하면 브라우저 주소창·도구막대가 사라져 <b>전광판과 기록이 훨씬 넓게</b> 보여요.
        아이콘으로 바로 열리고, 연습 게임은 오프라인에서도 돌아가요.
      </p>

      {done ? (
        <p className="install-done">설치했어요! 홈 화면의 ⚾ 아이콘으로 열어보세요.</p>
      ) : canPrompt && !fellBack ? (
        <button type="button" className="versus-primary install-btn" onClick={tryInstall}>
          ⚾ 지금 설치하기
        </button>
      ) : (
        <ol className="tut-rules install-steps">
          {STEPS[platform].map(([ico, text], i) => (
            <li key={i} className="tut-rule">
              <span className="tut-rule-ico" aria-hidden="true">
                {ico}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
