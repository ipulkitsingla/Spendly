import PDFDocument from 'pdfkit';
import { formatInr } from './mailer.js';

export function buildStatementPdfBuffer({ statement, userName, userEmail }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 95).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(26).font('Helvetica-Bold').text('Spendly', 40, 32);
    doc.fontSize(13).font('Helvetica').text('Monthly Statement', 40, 68);
    doc.fontSize(11).text(statement.monthLabel, doc.page.width - 40 - 200, 36, { align: 'right', width: 200 });

    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold');
    doc.text('Prepared for', 40, 120);
    doc.font('Helvetica').text(`${userName || 'User'}${userEmail ? ` · ${userEmail}` : ''}`, 40, 135);

    const boxY = 160;
    doc.roundedRect(40, boxY, 515, 65, 4).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold');
    
    const colW = 103;
    doc.text('OPENING', 40, boxY + 16, { width: colW, align: 'center' });
    doc.text('INCOME', 40 + colW, boxY + 16, { width: colW, align: 'center' });
    doc.text('EXPENSES', 40 + colW * 2, boxY + 16, { width: colW, align: 'center' });
    doc.text('NET', 40 + colW * 3, boxY + 16, { width: colW, align: 'center' });
    doc.text('CLOSING', 40 + colW * 4, boxY + 16, { width: colW, align: 'center' });

    doc.fillColor('#0f172a').fontSize(12).font('Helvetica');
    doc.text(formatInr(statement.openingBalance), 40, boxY + 34, { width: colW, align: 'center' });
    doc.text(formatInr(statement.income), 40 + colW, boxY + 34, { width: colW, align: 'center' });
    doc.text(formatInr(statement.expenses), 40 + colW * 2, boxY + 34, { width: colW, align: 'center' });
    doc.text(formatInr(statement.net), 40 + colW * 3, boxY + 34, { width: colW, align: 'center' });
    doc.text(formatInr(statement.closingBalance), 40 + colW * 4, boxY + 34, { width: colW, align: 'center' });

    let y = 255;
    
    const drawTableHeader = (startY) => {
      doc.rect(40, startY, 515, 24).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
      doc.text('Date', 48, startY + 7);
      doc.text('Details', 113, startY + 7);
      doc.text('Type', 338, startY + 7);
      doc.text('Amount (INR)', 390, startY + 7, { width: 80, align: 'right' });
      doc.text('Running', 470, startY + 7, { width: 77, align: 'right' });
      doc.font('Helvetica');
      return startY + 32;
    };

    y = drawTableHeader(y);

    doc.fontSize(9).fillColor('#334155');
    if (!statement.rows.length) {
      doc.text('No transactions in this month.', 48, y);
    } else {
      let isAlt = false;
      for (const row of statement.rows) {
        if (y > 760) {
          doc.addPage();
          y = 42;
          y = drawTableHeader(y);
        }
        
        if (isAlt) {
          doc.rect(40, y - 6, 515, 22).fill('#f8fafc');
        }
        doc.fillColor('#334155');
        
        doc.text(row.date, 48, y);
        doc.text(String(row.details || '').slice(0, 42), 113, y, { width: 210 });
        doc.text(row.type, 338, y, { width: 60 });
        
        let amtColor = '#334155';
        let amtPrefix = '';
        if (row.type === 'income') {
          amtColor = '#10b981';
          amtPrefix = '+ ';
        } else if (row.type === 'expense') {
          amtColor = '#ef4444';
          amtPrefix = '- ';
        } else if (row.type === 'balance_update') {
          amtColor = row.amount >= 0 ? '#10b981' : '#ef4444';
          amtPrefix = row.amount >= 0 ? '+ ' : '- ';
        }
        
        doc.fillColor(amtColor);
        doc.text(amtPrefix + formatInr(Math.abs(row.amount)), 390, y, { width: 80, align: 'right' });
        
        doc.fillColor('#334155');
        doc.text(formatInr(row.runningBalance), 470, y, { width: 77, align: 'right' });
        y += 22;
        isAlt = !isAlt;
      }
      doc.moveTo(40, y - 6).lineTo(555, y - 6).strokeColor('#e2e8f0').stroke();
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
