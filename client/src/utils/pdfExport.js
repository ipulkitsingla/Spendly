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
  if (t === 'expense') return `- ${formatInrPlain(Math.abs(raw))}`;
  if (t === 'income') return `+ ${formatInrPlain(Math.abs(raw))}`;
  if (t === 'balance_update') {
    const d = Number(tx.amount);
    const sign = d >= 0 ? '+' : '-';
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

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Spendly', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Monthly Statement', 14, 25);
  doc.setFontSize(10);
  doc.text(period, pageW - 14, 16, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  let y = 46;
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

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageW - 28, 28, 3, 3, 'FD');
  
  const boxY = y + 8;
  const colW = (pageW - 28) / 5;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('OPENING', 14 + colW*0.5, boxY, { align: 'center' });
  doc.text('INCOME', 14 + colW*1.5, boxY, { align: 'center' });
  doc.text('EXPENSES', 14 + colW*2.5, boxY, { align: 'center' });
  doc.text('NET', 14 + colW*3.5, boxY, { align: 'center' });
  doc.text('CLOSING', 14 + colW*4.5, boxY, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(formatInrPlain(opening), 14 + colW*0.5, boxY + 7, { align: 'center' });
  doc.text(formatInrPlain(income), 14 + colW*1.5, boxY + 7, { align: 'center' });
  doc.text(formatInrPlain(expense), 14 + colW*2.5, boxY + 7, { align: 'center' });
  doc.text(formatInrPlain(income - expense), 14 + colW*3.5, boxY + 7, { align: 'center' });
  doc.text(formatInrPlain(closing), 14 + colW*4.5, boxY + 7, { align: 'center' });
  
  y += 36;

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
      styles: { fontSize: 8, cellPadding: 2, textColor: [51, 65, 85] },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const text = data.cell.text[0] || '';
          if (text.startsWith('+')) {
            data.cell.styles.textColor = [16, 185, 129]; // emerald-500
          } else if (text.startsWith('-')) {
            data.cell.styles.textColor = [239, 68, 68]; // red-500
          }
        }
      },
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
