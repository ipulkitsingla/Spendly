import PDFDocument from 'pdfkit';
import { formatInr } from './mailer.js';

export function buildStatementPdfBuffer({ statement, userName, userEmail }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 85).fill('#10b981');
    doc.fillColor('#ffffff').fontSize(22).text('Spendly', 40, 26, { continued: true });
    doc.fontSize(12).text('  Monthly Statement', { baseline: 'middle' });
    doc.fontSize(10).text(statement.monthLabel, { align: 'right' });

    doc.fillColor('#0f172a').fontSize(10);
    doc.text(`Prepared for: ${userName || 'User'}${userEmail ? ` (${userEmail})` : ''}`, 40, 98);
    doc.text(`Transactions: ${statement.transactionCount}`, 40, 114);

    doc.roundedRect(40, 132, 515, 88, 8).fill('#f1f5f9');
    doc.fillColor('#334155').fontSize(11);
    doc.text(`Opening: ${formatInr(statement.openingBalance)}`, 52, 147);
    doc.text(`Income: ${formatInr(statement.income)}`, 52, 164);
    doc.text(`Expenses: ${formatInr(statement.expenses)}`, 52, 181);
    doc.text(`Net: ${formatInr(statement.net)}`, 290, 147);
    doc.text(`Closing: ${formatInr(statement.closingBalance)}`, 290, 164);

    let y = 245;
    doc.fillColor('#0f172a').fontSize(10).text('Date', 40, y);
    doc.text('Details', 105, y);
    doc.text('Type', 330, y);
    doc.text('Amount', 400, y, { width: 70, align: 'right' });
    doc.text('Running', 480, y, { width: 70, align: 'right' });
    y += 16;
    doc.moveTo(40, y - 6).lineTo(555, y - 6).strokeColor('#cbd5e1').stroke();

    doc.fontSize(9).fillColor('#1e293b');
    if (!statement.rows.length) {
      doc.text('No transactions in this month.', 40, y + 6);
    } else {
      for (const row of statement.rows) {
        if (y > 760) {
          doc.addPage();
          y = 42;
        }
        doc.text(row.date, 40, y);
        doc.text(String(row.details || '').slice(0, 42), 105, y, { width: 210 });
        doc.text(row.type, 330, y, { width: 60 });
        doc.text(formatInr(row.amount), 400, y, { width: 70, align: 'right' });
        doc.text(formatInr(row.runningBalance), 480, y, { width: 70, align: 'right' });
        y += 15;
      }
    }

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#94a3b8');
      doc.text(`Page ${i + 1} of ${totalPages} · Spendly · Amounts in INR`, 40, 810, { align: 'center' });
    }

    doc.end();
  });
}
