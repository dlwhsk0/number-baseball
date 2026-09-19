import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** .app의 세로 gap(px) — 타자석이 완전히 내려가면 이만큼도 같이 비운다. */
const APP_GAP = 12;
/** 끝을 넘겨 당길 때 고무줄 저항 — 최대 이만큼(px)까지만 따라온다. */
const RUBBER_MAX = 70;
/** 놓았을 때 반대쪽으로 넘어가는 기준: 전체 거리의 비율 또는 손 떼는 속도(px/ms). */
const FLIP_RATIO = 0.22;
const FLIP_VELOCITY = 0.45;

const rubber = (x: number) => RUBBER_MAX * (1 - Math.exp(-x / (RUBBER_MAX * 1.6)));

interface Drag {
  pointerId: number;
  y0: number;
  base: number;
  full: number;
  moved: boolean;
  lastY: number;
  lastT: number;
  vy: number;
}

/**
 * 전광판 아래 손잡이를 끌어내려 타자석(입력)을 밀어내고 전광판을 전체 화면으로 — 다시 올리면 복귀.
 * 타자석 래퍼(boxRef)에 음수 margin-bottom(offset)을 줘서 flex 레이아웃상 전광판이 그만큼 늘어난다.
 * 손을 따라 1:1로 움직이고, 끝을 넘기면 고무줄 저항, 놓으면 탄성 있게 스냅(CSS 트랜지션 오버슈트).
 * 타자석은 언마운트하지 않는다(입력·후보 메모 유지).
 */
export function usePullExpand() {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fullDistance = () => (boxRef.current?.offsetHeight ?? 0) + APP_GAP;

  const settle = useCallback((toOpen: boolean) => {
    setDragging(false);
    setOpen(toOpen);
    setOffset(toOpen ? fullDistance() : 0);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const full = fullDistance();
    const now = performance.now();
    dragRef.current = {
      pointerId: e.pointerId,
      y0: e.clientY,
      base: open ? full : 0,
      full,
      moved: false,
      lastY: e.clientY,
      lastT: now,
      vy: 0,
    };
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 4) d.moved = true;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    // 속도는 살짝 평활(마지막 순간 튐 방지).
    d.vy = d.vy * 0.4 + ((e.clientY - d.lastY) / dt) * 0.6;
    d.lastY = e.clientY;
    d.lastT = now;
    let raw = d.base + dy;
    if (raw < 0) raw = -rubber(-raw);
    else if (raw > d.full) raw = d.full + rubber(raw - d.full);
    setOffset(raw);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // 손으로 끈 뒤엔 포커스를 놓는다 — 남아 있으면 Enter가 던지기 대신 손잡이 토글로 먹힌다.
    e.currentTarget.blur();
    // 거의 안 움직였으면 탭 = 토글.
    if (!d.moved) {
      settle(!open);
      return;
    }
    const dy = e.clientY - d.y0;
    const flip = d.full * FLIP_RATIO;
    const toOpen = open
      ? !(dy < -flip || d.vy < -FLIP_VELOCITY)
      : dy > flip || d.vy > FLIP_VELOCITY;
    settle(toOpen);
  };

  const onPointerCancel = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    settle(open);
  };

  const full = boxRef.current?.offsetHeight ? boxRef.current.offsetHeight + APP_GAP : 1;
  const progress = Math.max(0, Math.min(1, offset / full));

  return {
    open,
    dragging,
    boxRef,
    /** 강제로 접기(키보드 입력·게임 종료 등). */
    collapse: useCallback(() => settle(false), [settle]),
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // 전역 키패드 단축키(Enter=던지기)로 새지 않게.
          e.stopPropagation();
          settle(!open);
        }
      },
    },
    boxStyle: {
      marginBottom: -offset,
      opacity: 1 - progress,
      transition: dragging
        ? 'none'
        : 'margin-bottom 0.46s cubic-bezier(0.22, 1.3, 0.36, 1), opacity 0.3s ease',
    } as React.CSSProperties,
  };
}
