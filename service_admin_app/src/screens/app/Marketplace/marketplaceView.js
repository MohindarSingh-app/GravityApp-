import { marketplaceApi } from '../../../api/resources';

export function money(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function orderLabel(order) {
  return `#${order.orderNumber || String(order.id).slice(0, 8)}`;
}

export function categoryGlyph(name) {
  const text = String(name || '').toLowerCase();
  if (text.includes('switch')) return 'bolt';
  if (text.includes('cable') || text.includes('wire')) return 'cable';
  if (text.includes('vfd') || text.includes('drive')) return 'spark';
  if (text.includes('plc') || text.includes('auto')) return 'chip';
  if (text.includes('panel')) return 'hammer';
  if (text.includes('tool') || text.includes('safety')) return 'wrench';
  if (text.includes('light')) return 'sun';
  return 'box';
}

export function categoryTone(name) {
  const text = String(name || '').toLowerCase();
  if (text.includes('switch') || text.includes('vfd')) return 'emergency';
  if (text.includes('cable')) return 'teal';
  if (text.includes('plc') || text.includes('auto')) return 'project';
  if (text.includes('panel')) return 'repair';
  if (text.includes('tool')) return 'amc';
  if (text.includes('light')) return 'cert';
  return 'market';
}

export function stockLabel(product) {
  const qty = Number(product && product.stockQuantity);
  if (!Number.isFinite(qty) || qty <= 0) return 'Out of stock';
  if (qty < 8) return `Only ${qty} left`;
  return `${qty} in stock`;
}

export function productBrands(products) {
  const seen = new Set();
  return (products || []).reduce((list, product) => {
    const brand = String(product.brand || '').trim();
    if (!brand || seen.has(brand)) return list;
    seen.add(brand);
    list.push(brand);
    return list;
  }, []);
}

export function orderTitle(order) {
  const items = order.items || [];
  if (!items.length) return order.summary || `Order ${orderLabel(order)}`;
  return items
    .slice(0, 2)
    .map((item) => `${item.name} × ${item.quantity}`)
    .join(', ');
}

export function orderTimeline(order) {
  const status = String((order && order.status) || '').toLowerCase();
  const history = (order && order.history) || [];
  const byStatus = Object.fromEntries(history.map((event) => [String(event.status || '').toLowerCase(), event]));
  const steps = [
    { key: 'placed', title: 'Order Placed' },
    { key: 'confirmed', title: 'Confirmed by Supplier' },
    { key: 'dispatched', title: 'Dispatched' },
    { key: 'delivered', title: 'Delivered' },
  ];
  const rank = {
    placed: 0,
    pending: 0,
    confirmed: 1,
    processing: 1,
    dispatched: 2,
    shipped: 2,
    delivered: 3,
    completed: 3,
    cancelled: -1,
    canceled: -1,
  };
  const current = rank[status] == null ? -1 : rank[status];
  return steps.map((step, index) => {
    const event = byStatus[step.key];
    return {
      title: step.title,
      detail: event && event.note
        ? event.note
        : event && event.createdAt
          ? new Date(event.createdAt).toLocaleString()
          : 'No update recorded',
      state: current < 0
        ? 'pending'
        : index < current
          ? 'complete'
          : index === current
            ? 'active'
            : 'pending',
    };
  });
}

export async function loadProductRecord(productId, fallback, catalogLoader) {
  try {
    const fresh = await marketplaceApi.product(productId);
    if (fresh && (fresh.product || fresh.id)) return fresh.product || fresh;
  } catch (_error) {
    // Product detail endpoint is optional; use catalog or the passed snapshot.
  }
  if (fallback && fallback.id && String(fallback.id) === String(productId)) return fallback;
  if (catalogLoader) {
    const catalog = await catalogLoader();
    const match = ((catalog && catalog.products) || []).find((row) => String(row.id) === String(productId));
    if (match) return match;
  }
  throw new Error('This product could not be found.');
}
