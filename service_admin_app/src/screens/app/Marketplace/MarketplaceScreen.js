import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { marketplaceApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { canUseMarketplace } from '../../../constants/catalog';
import { getErrorMessage } from '../../../utils/errors';

const STAGES = {
  CATALOG: 'catalog',
  CART: 'cart',
  CHECKOUT: 'checkout',
  ORDERS: 'orders',
  ORDER: 'order',
};

function money(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function orderLabel(order) {
  return `#${order.orderNumber || String(order.id).slice(0, 8)}`;
}

export function MarketplaceScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, type } = useTheme();
  const { sites, loading: sitesLoading, error: sitesError } = useCompanySites();
  const [stage, setStage] = useState(STAGES.CATALOG);
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [cart, setCart] = useState({ items: [], itemCount: 0, subtotal: 0, currency: 'INR' });
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCatalog = useCallback(async () => {
    const result = await marketplaceApi.catalog({
      q: query.trim() || undefined,
      categoryId: categoryId || undefined,
    });
    setCatalog({
      categories: result.categories || [],
      products: result.products || [],
    });
  }, [categoryId, query]);

  const loadCart = useCallback(async () => {
    const result = await marketplaceApi.cart();
    setCart(result);
  }, []);

  const loadOrders = useCallback(async () => {
    const result = await marketplaceApi.orders();
    setOrders(result.orders || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (stage === STAGES.CATALOG) {
        await loadCatalog();
        await loadCart();
      } else if (stage === STAGES.CART || stage === STAGES.CHECKOUT) {
        await loadCart();
      } else if (stage === STAGES.ORDERS) {
        await loadOrders();
      } else if (stage === STAGES.ORDER && selectedOrder) {
        const result = await marketplaceApi.order(selectedOrder.id);
        setSelectedOrder(result);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [loadCart, loadCatalog, loadOrders, selectedOrder, stage]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function updateCart(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await loadCart();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function placeSandboxOrder() {
    if (!selectedSite) {
      setError('Select a delivery site to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await marketplaceApi.checkout({
        siteId: selectedSite,
        paymentMode: 'sandbox',
      });
      setNotice(`${result.message} Test reference: ${result.payment.reference}`);
      setStage(STAGES.ORDERS);
      setSelectedOrder(null);
      await marketplaceApi.orders().then((data) => setOrders(data.orders || []));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openOrder(order) {
    setBusy(true);
    setError('');
    try {
      const result = await marketplaceApi.order(order.id);
      setSelectedOrder(result);
      setStage(STAGES.ORDER);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const allowed = canUseMarketplace(user && user.role);
  const title = stage === STAGES.CATALOG
    ? 'Marketplace'
    : stage === STAGES.CART
      ? 'Your cart'
      : stage === STAGES.CHECKOUT
        ? 'Checkout'
        : stage === STAGES.ORDERS
          ? 'My orders'
          : 'Order tracking';

  if (!allowed) {
    return (
      <Screen header={<AppBar title="Marketplace" onBack={() => navigation.goBack()} />}>
        <EmptyState
          title="Marketplace access required"
          message="Ask your company owner or maintenance administrator to grant purchase access."
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<AppBar title={title} onBack={() => {
        if (stage === STAGES.CATALOG) navigation.goBack();
        else if (stage === STAGES.ORDER) setStage(STAGES.ORDERS);
        else if (stage === STAGES.CHECKOUT) setStage(STAGES.CART);
        else setStage(STAGES.CATALOG);
      }} />}
      refreshing={loading}
      onRefresh={load}
    >
      <Text style={type.display} accessibilityRole="header">{title}</Text>
      <Banner message={error || sitesError} />
      <Banner message={notice} tone="success" />
      {stage !== STAGES.CHECKOUT && stage !== STAGES.ORDER ? (
        <View style={styles.topActions}>
          <Button
            title={`Cart${cart.itemCount ? ` · ${cart.itemCount}` : ''}`}
            variant={stage === STAGES.CART ? 'primary' : 'secondary'}
            onPress={() => setStage(stage === STAGES.CART ? STAGES.CATALOG : STAGES.CART)}
          />
          <Button
            title="My orders"
            variant="ghost"
            onPress={() => setStage(STAGES.ORDERS)}
          />
        </View>
      ) : null}

      {stage === STAGES.CATALOG ? (
        <>
          <Text style={type.muted}>Catalog, price and stock are loaded from the company backend. Demo items appear only when the development seed is enabled.</Text>
          <TextField
            label="Search products"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={loadCatalog}
            returnKeyType="search"
          />
          <View style={styles.categories}>
            <CategoryChip
              label="All"
              active={!categoryId}
              onPress={() => setCategoryId('')}
            />
            {catalog.categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                active={categoryId === category.id}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </View>
          {!loading && !catalog.products.length ? (
            <EmptyState
              title="No products in the catalog"
              message="The live database catalog is empty. In development, seed clearly labelled demo products to test cart and sandbox checkout."
            />
          ) : catalog.products.map((product) => (
            <Card key={product.id} style={styles.productCard}>
              <View style={styles.productHead}>
                <View style={[styles.productIcon, { backgroundColor: colors.warningSurface }]}>
                  <Glyph name="box" color={colors.warning} size={20} />
                </View>
                <View style={styles.productCopy}>
                  <Text style={type.small}>{product.sku}{product.category ? ` · ${product.category}` : ''}</Text>
                  <Text style={type.heading}>{product.name}</Text>
                  {product.brand ? <Text style={type.small}>{product.brand}</Text> : null}
                </View>
              </View>
              {product.summary ? <Text style={type.body}>{product.summary}</Text> : null}
              <View style={styles.productFoot}>
                <View>
                  <Text style={[type.heading, { color: colors.accentText }]}>
                    {money(product.price, product.currency)}
                    <Text style={type.small}> / {product.unit}</Text>
                  </Text>
                  <Text style={type.small}>
                    {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}
                    {product.supplier ? ` · ${product.supplier}` : ''}
                  </Text>
                </View>
                <Button
                  title="Add"
                  disabled={!product.stockQuantity || busy}
                  onPress={() => updateCart(() => marketplaceApi.addToCart({
                    productId: product.id,
                    quantity: 1,
                  }))}
                />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {stage === STAGES.CART ? (
        <>
          {!cart.items.length ? (
            <EmptyState title="Your cart is empty" message="Browse the catalog and add the parts you need." />
          ) : cart.items.map((item) => (
            <Card key={item.productId} style={styles.cartItem}>
              <View style={styles.productCopy}>
                <Text style={type.small}>{item.sku}</Text>
                <Text style={type.heading}>{item.name}</Text>
                <Text style={type.body}>{money(item.price, item.currency)} / {item.unit}</Text>
                <Text style={type.small}>{item.stockQuantity} available</Text>
              </View>
              <View style={styles.quantityControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove one ${item.name}`}
                  disabled={busy}
                  onPress={() => updateCart(() => marketplaceApi.setCartItemQuantity(
                    item.productId,
                    item.quantity - 1,
                  ))}
                  style={[styles.quantityButton, { borderColor: colors.border }]}
                >
                  <Glyph name="minus" color={colors.text} size={17} />
                </Pressable>
                <Text style={type.heading}>{item.quantity}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add one ${item.name}`}
                  disabled={busy || item.quantity >= item.stockQuantity || item.quantity >= 99}
                  onPress={() => updateCart(() => marketplaceApi.setCartItemQuantity(
                    item.productId,
                    item.quantity + 1,
                  ))}
                  style={[styles.quantityButton, { borderColor: colors.border }]}
                >
                  <Glyph name="plus" color={colors.text} size={17} />
                </Pressable>
              </View>
            </Card>
          ))}
          {cart.items.length ? (
            <>
              <Card style={styles.totalCard}>
                <Text style={type.heading}>Estimated subtotal</Text>
                <Text style={[type.display, { color: colors.accentText }]}>
                  {money(cart.subtotal, cart.currency)}
                </Text>
                <Text style={type.small}>Final stock and prices are checked again by the server during checkout.</Text>
              </Card>
              <Button title="Continue to delivery" onPress={() => {
                setSelectedSite(sites.find((site) => site.isPrimary)?.id || sites[0]?.id || '');
                setStage(STAGES.CHECKOUT);
              }} />
            </>
          ) : null}
        </>
      ) : null}

      {stage === STAGES.CHECKOUT ? (
        <>
          <Card style={styles.sandboxNotice}>
            <Text style={[type.heading, { color: colors.warning }]}>Sandbox checkout · no real charge</Text>
            <Text style={type.body}>This temporary flow saves a test order and records a simulated sandbox payment. It does not collect money or confirm a real supplier order.</Text>
          </Card>
          <Text style={type.section}>Deliver to a saved site</Text>
          {sitesLoading ? <Text style={type.muted}>Loading company sites…</Text> : null}
          {!sitesLoading && !sites.length ? (
            <EmptyState title="No delivery sites found" message="Add an active company site in Profile before checkout." />
          ) : sites.map((site) => (
            <Pressable
              key={site.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedSite === site.id }}
              onPress={() => setSelectedSite(site.id)}
            >
              <Card style={[
                styles.siteCard,
                selectedSite === site.id && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              >
                <Text style={type.heading}>{site.siteName}{site.isPrimary ? ' · Primary' : ''}</Text>
                <Text style={type.body}>{[site.fullAddress || site.address, site.city, site.state].filter(Boolean).join(', ')}</Text>
              </Card>
            </Pressable>
          ))}
          <Button
            title="+ Add New Site"
            variant="secondary"
            onPress={() => {
              const parent = navigation.getParent();
              if (parent) parent.navigate('SitesList');
            }}
          />
          <Card style={styles.totalCard}>
            <Text style={type.heading}>Test total</Text>
            <Text style={[type.display, { color: colors.accentText }]}>{money(cart.subtotal, cart.currency)}</Text>
            <Text style={type.small}>Delivery charge is currently zero in this sandbox flow.</Text>
          </Card>
          <Button
            title="Place sandbox test order"
            loading={busy}
            disabled={!cart.items.length || sitesLoading || !sites.length}
            onPress={placeSandboxOrder}
          />
        </>
      ) : null}

      {stage === STAGES.ORDERS ? (
        !orders.length && !loading ? (
          <EmptyState title="No orders yet" message="Completed sandbox test orders and future provider-backed orders will appear here." />
        ) : orders.map((order) => (
          <Pressable key={order.id} onPress={() => openOrder(order)} disabled={busy}>
            <Card style={styles.orderCard}>
              <View style={styles.productFoot}>
                <Text style={type.heading}>Order {orderLabel(order)}</Text>
                <StatusBadge label={order.status} status={order.status} />
              </View>
              <Text style={type.body}>{order.siteName} · {order.itemCount} item(s)</Text>
              <Text style={type.small}>{money(order.total, order.currency)} · {new Date(order.createdAt).toLocaleString()}</Text>
              <Text style={[type.small, { color: colors.accentText }]}>View order tracking</Text>
            </Card>
          </Pressable>
        ))
      ) : null}

      {stage === STAGES.ORDER && selectedOrder ? (
        <>
          <Card style={styles.sandboxNotice}>
            <Text style={type.heading}>Order {orderLabel(selectedOrder)}</Text>
            <StatusBadge label={selectedOrder.status} status={selectedOrder.status} />
            {selectedOrder.payment && selectedOrder.payment.sandbox ? (
              <Text style={[type.small, { color: colors.warning }]}>Sandbox payment only · no money was charged.</Text>
            ) : null}
          </Card>
          <Text style={type.section}>Status history</Text>
          {selectedOrder.history.map((event) => (
            <Card key={event.id} style={styles.historyItem}>
              <StatusBadge label={event.status} status={event.status} />
              {event.note ? <Text style={type.body}>{event.note}</Text> : null}
              <Text style={type.small}>{new Date(event.createdAt).toLocaleString()}</Text>
            </Card>
          ))}
          <Text style={type.section}>Items</Text>
          {selectedOrder.items.map((item) => (
            <Card key={item.id} style={styles.orderCard}>
              <Text style={type.heading}>{item.name}</Text>
              <Text style={type.body}>{item.sku} · {item.quantity} × {money(item.unitPrice, selectedOrder.currency)}</Text>
              <Text style={type.small}>Line total: {money(item.lineTotal, selectedOrder.currency)}</Text>
            </Card>
          ))}
          <Card style={styles.totalCard}>
            <Text style={type.heading}>Delivery site</Text>
            <Text style={type.body}>{selectedOrder.shippingAddress && selectedOrder.shippingAddress.siteName}</Text>
            <Text style={type.small}>{selectedOrder.shippingAddress && selectedOrder.shippingAddress.address}</Text>
            <Text style={type.heading}>Total: {money(selectedOrder.total, selectedOrder.currency)}</Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function CategoryChip({ label, active, onPress }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? colors.primaryDark : colors.border,
          backgroundColor: active ? colors.primaryLight : colors.surface,
        },
      ]}
    >
      <Text style={[type.small, { color: active ? colors.accentText : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  productCard: {
    gap: 12,
  },
  productHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCopy: {
    flex: 1,
    gap: 4,
  },
  productFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCard: {
    gap: 8,
  },
  sandboxNotice: {
    gap: 10,
    borderColor: '#F2C66D',
  },
  siteCard: {
    gap: 6,
  },
  orderCard: {
    gap: 8,
  },
  historyItem: {
    gap: 7,
  },
});
