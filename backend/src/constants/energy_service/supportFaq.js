function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

// items: [{ code, label (question), summary (answer), meta: { keywords } }] from app_catalog_items.
function matchFaq(items, query) {
  const q = normalize(query);
  if (!q) return null;

  let best = null;
  let bestScore = 0;

  (items || []).forEach((item) => {
    let score = 0;
    const question = normalize(item.label);
    if (question.includes(q) || q.includes(question.slice(0, 12))) score += 8;
    ((item.meta && item.meta.keywords) || []).forEach((word) => {
      if (q.includes(word)) score += 3;
    });
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });

  return bestScore >= 3 ? best : null;
}

module.exports = { matchFaq };
