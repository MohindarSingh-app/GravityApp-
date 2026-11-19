import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { marketplaceApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { EmptyState } from '../../../components/EmptyState';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { Card } from '../../../components/ui/Card';
import { IconButton } from '../../../components/ui/IconButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { money, productBrands, stockLabel } from './marketplaceView';
import { useMarketplaceCart } from './useMarketplaceCart';

export function MarketplaceCategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, radius, type } = useTheme();
  const { cart } = useMarketplaceCart();
  const categoryId = (route.params && route.params.categoryId) || '';
  const categoryName = (route.params && route.params.categoryName) || 'Category';
  const [products, setProducts] = useState([]);
  const [brand, setBrand] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await marketplaceApi.catalog({ categoryId: categoryId || undefined });
      setProducts(result.products || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const brands = useMemo(() => productBrands(products), [products]);
  const visible = brand === 'all'
    ? products
    : products.filter((item) => item.brand === brand);

  return (
    <Screen
      header={(
        <AppBar
          title={categoryName}
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
      refreshing={!loading}
      onRefresh={() => { setLoading(true); load(); }}
    >
      <Banner message={error} />
      {brands.length ? (
        <SegmentedControl
          tabs={[{ id: 'all', label: 'All' }, ...brands.map((name) => ({ id: name, label: name }))]}
          value={brand}
          onChange={setBrand}
          scrollable
        />
      ) : null}
      {loading && !products.length ? <SkeletonStack rows={4} /> : null}
      {!loading && !visible.length ? (
        <EmptyState glyph="box" title="No products in this category" message="Try another brand or browse the full catalog." />
      ) : visible.map((product) => (
        <Card
          key={product.id}
          onPress={() => navigation.navigate('MarketplaceProduct', { productId: product.id, product })}
          accessibilityLabel={product.name}
        >
          <View style={styles.row}>
            <View style={[styles.thumb, { backgroundColor: colors.warningSurface, borderRadius: radius.chip }]}>
              <Glyph name="box" color={colors.warning} size={20} />
            </View>
            <View style={styles.copy}>
              <Text style={[type.small, { color: colors.textTertiary }]}>{product.brand || product.sku}</Text>
              <Text style={[type.heading, { color: colors.text }]} numberOfLines={2}>{product.name}</Text>
              <Text style={[type.heading, { color: colors.accentText }]}>{money(product.price, product.currency)}</Text>
              <Text style={[type.small, { color: colors.textSecondary }]}>{stockLabel(product)}</Text>
            </View>
            <Glyph name="chevron" color={colors.textTertiary} size={16} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
});
