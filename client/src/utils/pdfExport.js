import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMonthLong } from './dates.js';

function formatInrPlain(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return '—';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(x);
}

function txTitle(tx) {
  if (tx.type === 'transfer') {
    return (tx.note && tx.note.trim()) || tx.category || 'Transfer';
  }
  if (tx.type === 'balance_update') {
    return (tx.note && tx.note.trim()) || 'Balance update';
  }
  return (tx.note && tx.note.trim()) || tx.category || 'Transaction';
}

function amountCell(tx) {
  const t = tx.type;
  const raw = Number(tx.amount);
  if (t === 'expense') return `− ${formatInrPlain(Math.abs(raw))}`;
  if (t === 'income') return `+ ${formatInrPlain(Math.abs(raw))}`;
  if (t === 'balance_update') {
    const d = Number(tx.amount);
    const sign = d >= 0 ? '+' : '−';
    return `${sign} ${formatInrPlain(Math.abs(d))}`;
  }
  if (t === 'transfer') return formatInrPlain(Math.abs(raw));
  return formatInrPlain(raw);
}

function typeLabel(tx) {
  const t = tx.type;
  if (t === 'balance_update') return 'Balance';
  if (t === 'transfer') return 'Transfer';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatShortDate(iso) {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  } catch {
    return String(iso).slice(0, 10);
  }
}

/**
 * @param {object} opts
 * @param {string} opts.month YYYY-MM
 * @param {object} opts.bundle API GET /transactions response
 * @param {string} [opts.userName]
 * @param {string} [opts.userEmail]
 * @param {string} [opts.scopeLabel] e.g. "All accounts" or account name
 */
export function buildMonthStatementPdf(opts) {
  const { month, bundle, userName, userEmail, scopeLabel } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  const period = formatMonthLong(new Date(`${month}-01T12:00:00`));

  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Spendly', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Monthly statement', 14, 22);
  doc.setFontSize(9);
  doc.text(period, pageW - 14, 14, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  let y = 40;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared for', 14, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  doc.text(`${userName || 'User'}${userEmail ? ` · ${userEmail}` : ''}`, 14, y);
  y += 7;
  if (scopeLabel) {
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Scope: ${scopeLabel}`, 14, y);
    y += 6;
  }
  doc.setTextColor(15, 23, 42);

  const txs = [...(bundle.transactions || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const opening = Number(bundle.openingBalance) || 0;
  const closing = txs.length ? Number(txs[txs.length - 1].runningBalance) : opening;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, y, pageW - 28, 26, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const boxY = y + 5;
  doc.text(`Opening balance: ${formatInrPlain(opening)}`, 18, boxY);
  doc.text(`Total income: ${formatInrPlain(income)}`, 18, boxY + 5);
  doc.text(`Total expenses: ${formatInrPlain(expense)}`, 18, boxY + 10);
  doc.text(`Net (month): ${formatInrPlain(income - expense)}`, 18, boxY + 15);
  doc.text(`Closing (end of list): ${formatInrPlain(closing)}`, 18, boxY + 20);
  y += 32;

  const body = txs.map((tx) => [
    formatShortDate(tx.date),
    txTitle(tx).slice(0, 48),
    typeLabel(tx),
    amountCell(tx),
    tx.runningBalance != null && !Number.isNaN(Number(tx.runningBalance))
      ? formatInrPlain(tx.runningBalance)
      : '—',
  ]);

  if (body.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No transactions in this month.', 14, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Details', 'Type', 'Amount (INR)', 'Running']],
      body,
      styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [15, 23, 42] },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 58 },
        2: { cellWidth: 22 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 28 },
      },
      margin: { left: 14, right: 14 },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.2,
      showHead: 'everyPage',
    });
  }

  const pageH = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount} · Spendly · amounts in INR`, pageW / 2, pageH - 6, {
      align: 'center',
    });
  }

  return doc;
}

export function downloadMonthStatementPdf(opts) {
  const doc = buildMonthStatementPdf(opts);
  const safeMonth = opts.month.replace(/[^\d-]/g, '');
  doc.save(`Spendly-statement-${safeMonth}.pdf`);
}
