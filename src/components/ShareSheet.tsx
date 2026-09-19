import { useEffect, useRef, useState } from 'react';
import {
  buildShareText,
  canvasToBlob,
  drawRecordCard,
  type RecordSummary,
} from '../share/recordCard';

interface Props {
  record: RecordSummary;
  onClose: () => void;
}

const FILE_NAME = 'homerun-record.png';

/** 솔로 기록 공유 시트 — 이미지 미리보기 + 공유(네이티브 시트)·저장·복사. */
export function ShareSheet({ record, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const msgTimerRef = useRef<number | undefined>(undefined);
  const text = buildShareText(record);

  // 열릴 때 한 번 그려 둔다(공유 버튼은 사용자 제스처 안에서 바로 share를 호출해야 해서 미리 준비).
  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    canvasToBlob(drawRecordCard(record))
      .then((blob) => {
        if (!alive) return;
        objUrl = URL.createObjectURL(blob);
        setUrl(objUrl);
        setFile(new File([blob], FILE_NAME, { type: 'image/png' }));
      })
      .catch(() => alive && setMsg('이미지를 만들지 못했어요'));
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
    // 시트가 열려 있는 동안 기록은 바뀌지 않는다(게임 종료 후에만 열림).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    msgTimerRef.current = window.setTimeout(() => setMsg(null), 2200);
  };

  const canNativeShare =
    !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text, title: '숫자 야구 기록' });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') flash('공유하지 못했어요 — 저장·복사로 올려 주세요');
    }
  };

  const copyImageAndText = async () => {
    if (!file) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': file,
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      flash('이미지와 문구를 복사했어요!');
    } catch {
      // 이미지 클립보드를 못 쓰는 브라우저 → 문구만이라도.
      try {
        await navigator.clipboard.writeText(text);
        flash('이미지 복사는 안 돼서 문구만 복사했어요');
      } catch {
        flash('복사하지 못했어요');
      }
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash('문구를 복사했어요!');
    } catch {
      flash('복사하지 못했어요');
    }
  };

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="기록 공유"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="settings-title">기록 공유</h3>

        <div className="share-preview">
          {url ? (
            <img src={url} alt="이번 판 기록 이미지" />
          ) : (
            <span className="share-loading">이미지 만드는 중…</span>
          )}
        </div>
        <p className="share-hint">이미지를 길게 눌러도 저장할 수 있어요</p>

        <div className="share-actions">
          {canNativeShare && (
            <button type="button" className="versus-primary share-main" onClick={share}>
              📤 공유하기
            </button>
          )}
          <a
            className={`versus-secondary share-btn${url ? '' : ' disabled'}`}
            href={url ?? undefined}
            download={FILE_NAME}
            aria-disabled={!url}
          >
            🖼 이미지 저장
          </a>
          <button type="button" className="versus-secondary share-btn" onClick={copyImageAndText}>
            📋 이미지+문구 복사
          </button>
          <button
            type="button"
            className={`versus-secondary share-btn${canNativeShare ? ' share-wide' : ''}`}
            onClick={copyText}
          >
            📝 문구만 복사
          </button>
          {!canNativeShare && (
            <a
              className="versus-secondary share-btn"
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              𝕏 에 올리기
            </a>
          )}
        </div>
        {!canNativeShare && (
          <p className="share-hint">이미지는 복사한 뒤 글쓰기 창에 붙여넣으면 돼요</p>
        )}

        <button type="button" className="settings-close" onClick={onClose}>
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
