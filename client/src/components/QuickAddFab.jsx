import { useEffect, useState } from 'react';

export default function QuickAddFab({ onPick }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => {
      setOpen((v) => {
        const next = !v;
        if (next && typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
        return next;
      });
    };
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    window.addEventListener('spendly-toggle-quick-add', handleToggle);
    window.addEventListener('spendly-open-quick-add', handleOpen);
    window.addEventListener('spendly-close-quick-add', handleClose);
    return () => {
      window.removeEventListener('spendly-toggle-quick-add', handleToggle);
      window.removeEventListener('spendly-open-quick-add', handleOpen);
      window.removeEventListener('spendly-close-quick-add', handleClose);
    };
  }, []);

  const handlePick = (mode) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
    setOpen(false);
    window.dispatchEvent(new CustomEvent('spendly-close-quick-add'));
    onPick(mode);
  };

  const handleClose = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('spendly-close-quick-add'));
  };

  const handleToggle = () => {
    const next = !open;
    if (next && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
    setOpen(next);
    if (!next) {
      window.dispatchEvent(new CustomEvent('spendly-close-quick-add'));
    } else {
      window.dispatchEvent(new CustomEvent('spendly-open-quick-add'));
    }
  };

  return (
    <>
      {open && (
        <div
          className="fab-backdrop animate-fade-in"
          role="presentation"
          onClick={handleClose}
        />
      )}
      <div className={`fab-wrap ${open ? 'fab-wrap--open' : ''}`}>
        {open && (
          <div className="fab-speed-dial">
            {/* Pending */}
            <div className="fab-dial-item item-pending">
              <span className="fab-dial-label">Pending</span>
              <button
                type="button"
                className="fab-dial-btn btn-pending"
                aria-label="Add Pending Debt"
                title="Pending Debt / Lent"
                onClick={() => handlePick('pending')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </button>
            </div>

            {/* Transfer */}
            <div className="fab-dial-item item-transfer">
              <span className="fab-dial-label">Transfer</span>
              <button
                type="button"
                className="fab-dial-btn btn-transfer"
                aria-label="Add Transfer"
                title="Transfer Funds"
                onClick={() => handlePick('transfer')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 3L21 8L16 13" />
                  <path d="M21 8H3" />
                  <path d="M8 21L3 16L8 11" />
                  <path d="M3 16H21" />
                </svg>
              </button>
            </div>

            {/* Income */}
            <div className="fab-dial-item item-income">
              <span className="fab-dial-label">Income</span>
              <button
                type="button"
                className="fab-dial-btn btn-income"
                aria-label="Add Income"
                title="Add Income"
                onClick={() => handlePick('income')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {/* Expense */}
            <div className="fab-dial-item item-expense">
              <span className="fab-dial-label">Expense</span>
              <button
                type="button"
                className="fab-dial-btn btn-expense"
                aria-label="Add Expense"
                title="Add Expense"
                onClick={() => handlePick('expense')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          className={`fab-main ${open ? 'fab-main--open' : ''}`}
          aria-label={open ? 'Close quick actions' : 'Add transaction'}
          title={open ? 'Close quick actions' : 'Add transaction (+)'}
          onClick={handleToggle}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="fab-icon-plus">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </>
  );
}



