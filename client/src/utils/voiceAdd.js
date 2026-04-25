function titleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function clean(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function bestAccountMatch(accounts, phrase) {
  const needle = clean(phrase);
  if (!needle) return null;
  const needles = needle.split(' ');
  let best = null;
  let bestScore = 0;
  for (const acc of accounts || []) {
    const name = String(acc?.name || '');
    if (!name) continue;
    const hay = clean(name);
    if (!hay) continue;
    let score = 0;
    if (hay === needle) score += 6;
    if (hay.includes(needle) || needle.includes(hay)) score += 4;
    for (const t of needles) {
      if (t.length < 2) continue;
      if (hay.includes(t)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = acc;
    }
  }
  return bestScore >= 2 ? best : null;
}

function extractAccountPhrase(text) {
  const m =
    text.match(/\b(?:from|using|via|in|to)\s+([a-z0-9][a-z0-9\s-]{1,40})$/i) ||
    text.match(/\b(?:from|using|via|in|to)\s+([a-z0-9][a-z0-9\s-]{1,40})\b/i);
  return m ? m[1].trim() : '';
}

function removeKeywords(text) {
  return text
    .replace(/\b(hey spendly|ok spendly|spendly)\b/gi, '')
    .replace(/\b(log|add|spent|spend|paid|pay|income|expense|credit|debit|received|earned|got|from|using|via|in|to)\b/gi, '')
    .replace(/(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?/gi, '')
    .replace(/\b(today|now)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCategory(baseText, categories) {
  const plain = baseText.toLowerCase();
  const directPhrase =
    plain.match(/\b(?:for|on)\s+([a-z][a-z0-9 &-]{1,40})\b(?:\s+(?:from|using|via|in|to)\b|$)/i)?.[1] || '';
  if (directPhrase) {
    return titleCase(directPhrase);
  }
  for (const c of categories || []) {
    const name = String(c?.name || '').trim();
    if (!name) continue;
    if (plain.includes(name.toLowerCase())) return name;
  }
  const candidate = removeKeywords(baseText);
  if (!candidate) return null;
  return titleCase(candidate);
}

export function parseVoiceAdd(rawText, { categories = [], accounts = [] } = {}) {
  const source = String(rawText || '').trim();
  const text = normalize(source);
  if (!text) return { ok: false, message: 'No voice text detected' };

  const amount = detectAmount(text);
  if (amount == null || Number.isNaN(amount) || amount <= 0) {
    return { ok: false, message: 'Could not hear amount. Try "log ₹120 lunch".' };
  }

  const type = detectType(text);
  const category = detectCategory(source, categories) || (type === 'income' ? 'Income' : 'Other');
  const accountPhrase = extractAccountPhrase(source);
  const accountMatch = accountPhrase ? bestAccountMatch(accounts, accountPhrase) : null;

  return {
    ok: true,
    payload: {
      type,
      amount,
      category,
      note: source,
    },
    accountHint: accountMatch
      ? {
          accountId: String(accountMatch._id),
          accountName: accountMatch.name,
        }
      : null,
  };
}
