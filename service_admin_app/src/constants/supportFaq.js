function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

export function faqCategoriesFrom(items) {
  return (items || []).map((item) => ({
    id: item.code,
    label: item.label,
    glyph: item.glyph || 'book',
    tone: item.tone || 'info',
  }));
}

export function faqItemsFrom(items) {
  return (items || []).map((item) => ({
    id: item.code,
    category: (item.meta && item.meta.category) || '',
    question: item.label,
    keywords: (item.meta && item.meta.keywords) || [],
    answer: item.summary || '',
  }));
}

export function matchFaq(items, query) {
  const q = normalize(query);
  if (!q) return null;

  let best = null;
  let bestScore = 0;

  items.forEach((item) => {
    let score = 0;
    const question = normalize(item.question);
    if (question.includes(q) || q.includes(question.slice(0, 12))) score += 8;
    (item.keywords || []).forEach((word) => {
      if (q.includes(word)) score += 3;
    });
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });

  return bestScore >= 3 ? best : null;
}

export function filterFaqs(items, { query = '', category = 'all' }) {
  const q = normalize(query);
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (!q) return true;
    const haystack = `${item.question} ${(item.keywords || []).join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
}
