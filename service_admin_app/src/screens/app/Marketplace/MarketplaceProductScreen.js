import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { marketplaceApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { Card } from '../../../components/ui/Card';
import { IconButton } from '../../../components/ui/IconButton';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { loadProductRecord, money, stockLabel } from './marketplaceView';
import { useMarketplaceCart } from './useMarketplaceCart';

export function MarketplaceProductScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, radius, type } = useTheme();
  const { cart, busy, error: cartError, setError: setCartError, update } = useMarketplaceCart();
  const productId = route.params && route.params.productId;
  const fallback = route.params && route.params.product;
  const [product, setProduct] = useState(fallback || null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(!fallback);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!productId) {
      setError('This product could not be opened.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const record = await loadProductRecord(productId, fallback, () => marketplaceApi.catalog());
      setProduct(record);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fallback, productId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function addToCart() {
    if (!product) return;
    setNotice('');
    try {
      await update(() => marketplaceApi.addToCart({
        productId: product.id,
        quantity: qty,
      }));
      setNotice(`${product.name} added to cart.`);
    } catch (_err) {
      // Cart hook already stores the error.
    }
  }

  if (loading && !product) {
    return (
      <Screen header={<AppBar title="Product Details" onBack={() => navigation.goBack()} />}>
        <SkeletonStack rows={4} />
      </Screen>
    );
  }

  const inStock = product && Number(product.stockQuantity) > 0;
  const maxQty = Math.min(99, Number((product && product.stockQuantity) || 1));

  return (
    <Screen
      header={(
        <AppBar
          title="Product Details"
          onBack={() => navigation.goBack()}
          right={(
            <IconButton
              glyph="cart"
              label="Cart"
              badge={cart.itemCount || undefined}
              onPress={() => navigation.navigate('MarketplaceCart')}
            />
          )}
        />
      )}
      headerColor={colors.background}
    >
      <Banner message={error || cartError} />
      <Banner message={notice} tone="success" />
      {product ? (
        <>
          <View style={[styles.hero, { backgroundColor: colors.surfaceMuted, borderRadius: radius.card }]}>
            <Glyph name="box" color={colors.textTertiary} size={56} />
          </View>
          <Text style={[type.small, styles.kicker, { color: colors.textTertiary }]}>
            {product.category || product.sku}
          </Text>
          <Text style={[type.display, { color: colors.text }]}>{product.name}</Text>
          {product.brand ? <Text style={[type.body, { color: colors.textSecondary }]}>{product.brand}</Text> : null}
          <Text style={[type.title, { color: colors.text }]}>{money(product.price, product.currency)}</Text>
          <Text style={[type.small, { color: inStock ? colors.success : colors.danger }]}>{stockLabel(product)}</Text>

          <Card>
            <View style={styles.meta}>
              <Text style={[type.small, { color: colors.textTertiary }]}>Sold by</Text>
              <Text style={type.heading}>{product.supplier || 'Gravity Hub Marketplace'}</Text>
            </View>
            <View style={styles.meta}>
              <Text style={[type.small, { color: colors.textTertiary }]}>Delivery</Text>
              <Text style={type.heading}>Via Gravity Hub Delivery Partner</Text>
            </View>
          </Card>

          <Text style={[type.label, { color: colors.text }]}>Description</Text>
          <Card>
            <Text style={type.body}>
              {product.summary || product.description || 'Industrial spare sourced through the company marketplace catalog.'}
            </Text>
          </Card>

          <View style={styles.qtyRow}>
            <Text style={[type.heading, { color: colors.text }]}>Quantity</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                disabled={qty <= 1}
                onPress={() => setQty((current) => Math.max(1, current - 1))}
                style={[styles.step, { borderColor: colors.border, borderRadius: radius.sm }]}
              >
                <Glyph name="minus" color={colors.text} size={16} />
              </Pressable>
              <Text style={type.heading}>{qty}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                disabled={qty >= maxQty}
                onPress={() => setQty((current) => Math.min(maxQty, current + 1))}
                style={[styles.step, { borderColor: colors.border, borderRadius: radius.sm }]}
              >
                <Glyph name="plus" color={colors.text} size={16} />
              </Pressable>
            </View>
          </View>

          <Button
            title="Add to Cart"
            loading={busy}
            disabled={!inStock}
            onPress={() => {
              setCartError('');
              addToCart();
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  meta: {
    gap: 2,
    paddingVertical: 6,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  step: {
    width: 32,
    height: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
