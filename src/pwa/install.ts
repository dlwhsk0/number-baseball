/**
 * PWA 설치 안내용 플랫폼 판별 + 설치 프롬프트 보관.
 *
 * beforeinstallprompt는 앱이 뜬 직후 한 번만 날아오므로, 컴포넌트가 아니라
 * 이 모듈이 로드되는 시점(main.tsx의 부수효과 임포트)에 잡아둔다.
 * iOS는 이 API가 없어 항상 수동 안내(공유 → 홈 화면에 추가)로 간다.
 */
import { useEffect, useState } from 'react';

export type Platform = 'ios' | 'android' | 'desktop';

/** 설치된 앱으로 실행 중인지. index.html의 리다이렉트 스크립트와 같은 규칙. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia?.('(display-mode: standalone)').matches || iosStandalone;
}

export function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  // iPadOS 13+는 데스크톱 사파리로 위장한다 — 터치 포인트로 가려낸다.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** beforeinstallprompt 이벤트(표준 타입이 없어 필요한 부분만). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 미니 배너를 막고 우리가 원하는 자리(튜토리얼·설정)에서 띄운다.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** 원탭 설치. 프롬프트가 없거나 사용자가 거절하면 false — 호출부는 수동 안내로 폴백. */
export async function promptInstall(): Promise<boolean> {
  const p = deferred;
  if (!p) return false;
  // 프롬프트는 일회용 — 성공/거절과 무관하게 버린다.
  deferred = null;
  notify();
  try {
    await p.prompt();
    const { outcome } = await p.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

/** 설치 안내에 필요한 상태. canPrompt는 프롬프트가 도착/소비될 때마다 갱신된다. */
export function useInstallState() {
  const [canPrompt, setCanPrompt] = useState(() => deferred !== null);
  useEffect(() => {
    const f = () => setCanPrompt(deferred !== null);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return { platform: getPlatform(), canPrompt };
}
