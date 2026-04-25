function titleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectType(text) {
  if (/\b(income|credit|received|salary|earned|got)\b/.test(text)) return 'income';
  if (/\b(expense|spent|spend|paid|pay|debit|buy|bought|log)\b/.test(text)) return 'expense';
  return 'expense';
}

function detectAmount(text) {
  const m = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

function removeKeywords(text) {
  return text
    .replace(/\b(hey spendly|ok spendly|spendly)\b/gi, '')
    .replace(/\b(log|add|spent|spend|paid|pay|income|expense|credit|debit|received|earned|got)\b/gi, '')
    .replace(/(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?/gi, '')
    .replace(/\b(today|now)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCategory(baseText, categories) {
  const plain = baseText.toLowerCase();
  for (const c of categories || []) {
    const name = String(c?.name || '').trim();
    if (!name) continue;
    if (plain.includes(name.toLowerCase())) return name;
  }
  const candidate = removeKeywords(baseText);
  if (!candidate) return null;
  return titleCase(candidate);
}

export function parseVoiceAdd(rawText, categories = []) {
  const source = String(rawText || '').trim();
  const text = normalize(source);
  if (!text) return { ok: false, message: 'No voice text detected' };

  const amount = detectAmount(text);
  if (amount == null || Number.isNaN(amount) || amount <= 0) {
    return { ok: false, message: 'Could not hear amount. Try "log ₹120 lunch".' };
  }

  const type = detectType(text);
  const category = detectCategory(source, categories) || (type === 'income' ? 'Income' : 'Other');

  return {
    ok: true,
    payload: {
      type,
      amount,
      category,
      note: source,
    },
  };
}
