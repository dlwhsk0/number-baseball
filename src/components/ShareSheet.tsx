import { useEffect, useRef, useState } from 'react';
import {
  buildShareText,
  canvasToBlob,
  CARD_FORMATS,
  drawRecordCard,
  SHARE_URL,
  type CardFormat,
  type RecordSummary,
} from '../share/recordCard';
import type { Team } from '../game/teams';

interface Props {
  record: RecordSummary;
  /** 응원 구단 테마가 적용 중이면 그 구단 — 이미지에 엠블럼을 넣는다(끌 수 있음). */
  team?: Team;
  onClose: () => void;
}

function initialWithLogo(): boolean {
  try {
    return localStorage.getItem('nb_share_logo') !== '0';
  } catch {
    return true;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

type Files = Record<CardFormat, { blob: Blob; url: string }>;

/** 저장 파일명 `homerun-YYYYMMDD-HHmmss.png` — 고정 이름이면 두 번째 저장부터 이름 충돌 창이 떠 공유 흐름을 막는다. */
function cardFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `homerun-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

/**
 * 솔로 기록 공유 시트 — 아이폰 공유 시트처럼 아이콘 4개:
 *  인스타(스토리 9:16 이미지 + 링크 복사) · X(문구 채운 트윗 작성창) · 이미지(게시물 4:5 저장) · 문구(복사).
 *  인스타·X·이미지는 먼저 이미지를 무조건 다운로드한 뒤 각 공유 방법으로 넘어간다.
 */
export function ShareSheet({ record, team, onClose }: Props) {
  const [files, setFiles] = useState<Files | null>(null);
  const [withLogo, setWithLogo] = useState(initialWithLogo);
  const useLogo = !!team && withLogo;
  const [msg, setMsg] = useState<string | null>(null);
  const msgTimerRef = useRef<number | undefined>(undefined);
  const text = buildShareText(record);

  // 두 형식을 미리 그려 둔다(공유는 탭 제스처 안에서 바로 호출해야 해서 비동기 준비를 끝내 둠).
  //  색은 현재 테마(응원 구단 테마 포함) 토큰을 그대로 쓰고, 로고는 스위치로 넣고 뺀다.
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    const logoP = useLogo && team ? loadImage(team.logo) : Promise.resolve(null);
    logoP
      .then((logo) =>
        Promise.all(
          (Object.keys(CARD_FORMATS) as CardFormat[]).map(async (f) => {
            const blob = await canvasToBlob(drawRecordCard(record, f, { logo }));
            const url = URL.createObjectURL(blob);
            urls.push(url);
            return [f, { blob, url }] as const;
          }),
        ),
      )
      .then((entries) => alive && setFiles(Object.fromEntries(entries) as Files))
      .catch(() => alive && setMsg('이미지를 만들지 못했어요'));
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // 시트가 열려 있는 동안 기록은 바뀌지 않는다(게임 종료 후에만 열림).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLogo]);

  const toggleLogo = () => {
    const next = !withLogo;
    setFiles(null);
    setWithLogo(next);
    try {
      localStorage.setItem('nb_share_logo', next ? '1' : '0');
    } catch {
      /* 무시 */
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(msgTimerRef.current);
    };
  }, [onClose]);

  const flash = (m: string) => {
    setMsg(m);
    window.clearTimeout(msgTimerRef.current);
    msgTimerRef.current = window.setTimeout(() => setMsg(null), 2600);
  };

  const canShareFile = (f: File) =>
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });

  const download = (f: CardFormat, name: string) => {
    if (!files) return;
    const a = document.createElement('a');
    a.href = files[f].url;
    a.download = name;
    a.click();
  };

  /** 파일 공유 시트(모바일) — 이미지는 이미 받아 뒀으니 지원 안 되거나 실패하면 그냥 넘어간다. */
  const shareFile = async (f: CardFormat, name: string): Promise<void> => {
    if (!files) return;
    const file = new File([files[f].blob], name, { type: 'image/png' });
    if (!canShareFile(file)) return;
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* 취소·실패 — 다운로드는 이미 됐다 */
    }
  };

  // 인스타·X·이미지는 누르면 무조건 이미지를 먼저 내려받고, 이어서 각자의 공유 방법으로 넘어간다.

  // 인스타: 스토리용 이미지. 링크 스티커는 웹에서 자동으로 못 붙이므로 링크를 같은 탭 안에서 먼저 복사.
  const onInsta = async () => {
    navigator.clipboard?.writeText(SHARE_URL).catch(() => {});
    const name = cardFileName();
    download('story', name);
    flash('이미지 저장 · 링크 복사됨 — 스토리 🔗 스티커에 붙여넣기');
    await shareFile('story', name);
  };

  // X: 게시물 이미지를 받아 두고, 꼬들처럼 문구가 채워진 작성 창을 연다(이미지는 직접 첨부).
  const onX = () => {
    download('post', cardFileName());
    flash('이미지를 저장했어요 — 트윗에 첨부해 주세요');
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  // 이미지: 게시물(4:5) 이미지 저장 + 모바일은 공유 시트까지.
  const onImage = async () => {
    const name = cardFileName();
    download('post', name);
    flash('이미지를 저장했어요');
    await shareFile('post', name);
  };

  const onText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash('문구를 복사했어요!');
    } catch {
      flash('복사하지 못했어요');
    }
  };

  const targets = [
    { key: 'insta', label: '인스타', icon: <InstaIcon />, onClick: onInsta, needsFile: true },
    { key: 'x', label: 'X', icon: <XIcon />, onClick: onX, needsFile: true },
    { key: 'image', label: '이미지', icon: <ImageIcon />, onClick: onImage, needsFile: true },
    { key: 'text', label: '문구', icon: <TextIcon />, onClick: onText, needsFile: false },
  ];

  return (
    <div className="modal-backdrop share-backdrop" onClick={onClose}>
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="기록 공유"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="share-grabber" aria-hidden="true" />
        <div className="share-preview">
          {files ? (
            <img src={files.post.url} alt="이번 판 기록 이미지" />
          ) : (
            <span className="share-loading">이미지 만드는 중…</span>
          )}
        </div>

        {team && (
          <label className="share-logo-row">
            <img src={team.logo} alt="" className="share-logo-thumb" />
            <span className="share-logo-text">{team.short} 로고 넣기</span>
            <input
              type="checkbox"
              role="switch"
              className="ios-switch"
              checked={withLogo}
              onChange={toggleLogo}
            />
          </label>
        )}

        <div className="share-targets">
          {targets.map((t) => (
            <button
              key={t.key}
              type="button"
              className="share-target"
              disabled={t.needsFile && !files}
              onClick={t.onClick}
            >
              <span className={`share-icon share-icon-${t.key}`}>{t.icon}</span>
              <span className="share-label">{t.label}</span>
            </button>
          ))}
        </div>

        <button type="button" className="share-cancel" onClick={onClose}>
          닫기
        </button>

        {msg && (
          <div className="share-toast" role="status">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

function InstaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="#fff" stroke="none" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9.5" r="1.8" fill="currentColor" stroke="none" />
      <path d="M21 16l-5.2-5.2L7 19.6" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="8" width="12" height="13" rx="2.5" />
      <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-7A2.5 2.5 0 0 0 4 5.5v9A2.5 2.5 0 0 0 6.5 17H8" />
    </svg>
  );
}
