import { useRef, useState } from 'react';

const REVEAL = 148;
const SNAP = REVEAL * 0.45;

/** Swipe left (touch) to reveal Edit / Delete. Tap row to open editor. */
export default function SwipeableRow({ children, onEdit, onDelete }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const live = useRef(0);
  const drag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startOff: 0,
    horizontal: false,
  });

  const close = () => {
    live.current = 0;
    setOffset(0);
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    drag.current = {
      active: true,
      startX: t.clientX,
      startY: t.clientY,
      startOff: live.current,
      horizontal: false,
    };
    setDragging(true);
  };

  const onTouchMove = (e) => {
    if (!drag.current.active) return;
    const t = e.touches[0];
    const dx = t.clientX - drag.current.startX;
    const dy = t.clientY - drag.current.startY;
    if (!drag.current.horizontal) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        drag.current.horizontal = true;
      } else if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        drag.current.active = false;
        setDragging(false);
        return;
      }
    }
    if (!drag.current.horizontal) return;
    if (e.cancelable) e.preventDefault();
    const next = Math.min(0, Math.max(-REVEAL, drag.current.startOff + dx));
    live.current = next;
    setOffset(next);
  };

  const onTouchEnd = () => {
    if (!drag.current.active) {
      drag.current.active = false;
      setDragging(false);
      return;
    }
    const wasHorizontal = drag.current.horizontal;
    drag.current.active = false;
    drag.current.horizontal = false;
    setDragging(false);

    if (!wasHorizontal) return;

    const x = live.current;
    const snapped = x < -SNAP ? -REVEAL : 0;
    live.current = snapped;
    setOffset(snapped);
  };

  const revealed = offset < -14;

  return (
    <div className={`swipe-row-wrap glass-bleed${revealed ? ' swipe-row-wrap--open' : ''}`}>
      <div className="swipe-row-actions">
        <button type="button" className="swipe-act swipe-act-edit" onClick={() => { close(); onEdit?.(); }}>
          Edit
        </button>
        <button
          type="button"
          className="swipe-act swipe-act-del"
          onClick={() => {
            close();
            onDelete?.();
          }}
        >
          Del
        </button>
      </div>
      <div
        className={`swipe-row-panel glass${dragging ? ' swipe-row-panel--drag' : ''}`}
        style={{ transform: `translate3d(${offset}px,0,0)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
