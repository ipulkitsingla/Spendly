import { useState } from 'react';

export default function QuickAddFab({ onPick }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fab-wrap">
      {open && (
        <div className="fab-menu">
          <button type="button" className="fab-item fab-item--income" onClick={() => { setOpen(false); onPick('income'); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>Income</span>
          </button>
          <button type="button" className="fab-item fab-item--expense" onClick={() => { setOpen(false); onPick('expense'); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
            <span>Expense</span>
          </button>
          <button type="button" className="fab-item fab-item--transfer" onClick={() => { setOpen(false); onPick('transfer'); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3L21 8L16 13"/><path d="M21 8H3"/><path d="M8 21L3 16L8 11"/><path d="M3 16H21"/></svg>
            <span>Transfer</span>
          </button>
          <button type="button" className="fab-item fab-item--pending" onClick={() => { setOpen(false); onPick('pending'); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>Pending</span>
          </button>
        </div>
      )}
      <button
        type="button"
        className={`fab-main ${open ? 'fab-main--open' : ''}`}
        aria-label="Quick add"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="fab-icon-plus"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>
  );
}
