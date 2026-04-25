import { useState } from 'react';

export default function QuickAddFab({ onPick }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fab-wrap">
      {open && (
        <div className="fab-menu">
          <button type="button" className="fab-item income" onClick={() => { setOpen(false); onPick('income'); }}>
            <span>＋</span> Income
          </button>
          <button type="button" className="fab-item expense" onClick={() => { setOpen(false); onPick('expense'); }}>
            <span>－</span> Expense
          </button>
          <button type="button" className="fab-item transfer" onClick={() => { setOpen(false); onPick('transfer'); }}>
            <span>⇄</span> Transfer
          </button>
          <button type="button" className="fab-item pending" onClick={() => { setOpen(false); onPick('pending'); }}>
            <span>🧾</span> Pending
          </button>
        </div>
      )}
      <button
        type="button"
        className="fab-main"
        aria-label="Quick add"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '×' : '＋'}
      </button>
    </div>
  );
}
