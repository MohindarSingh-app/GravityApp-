import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { marketplaceApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { EmptyState } from '../../../components/EmptyState';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { IconButton } from '../../../components/ui/IconButton';
import { MiniCard } from '../../../components/ui/MiniCard';
import { SearchBar } from '../../../components/ui/SearchBar';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { canUseMarketplace } from '../../../constants/catalog';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { categoryGlyph, categoryTone, money, stockLabel } from './marketplaceView';
import { useMarketplaceCart } from './useMarketplaceCart';
import { Card } from '../../../components/ui/Card';
import { Glyph } from '../../../components/Glyph';

export function MarketplaceHomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, radius, type } = useTheme();
  const { cart } = useMarketplaceCart();
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await marketplaceApi.catalog({ q: applied.trim() || undefined });
      setCatalog({
        categories: result.categories || [],
        products: result.products || [],
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (!canUseMarketplace(user && user.role)) {
    return (
      <Screen header={<AppBar title="Marketplace" onBack={() => navigation.goBack()} />}>
        <EmptyState
          glyph="cart"
          title="Marketplace access required"
          message="Ask your company owner or maintenance administrator to grant purchase access."
        />
      </Screen>
    );
  }

  const featured = catalog.products.slice(0, 6);

  return (
    <Screen
      header={(
        <AppBar
          title="Marketplace"
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
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search products, brands..."
        accessibilityLabel="Search products"
        onSubmitEditing={() => setApplied(query.trim())}
      />

      <SectionHeader
        title="Categories"
        actionLabel="My Orders"
        onAction={() => navigation.navigate('MarketplaceOrders')}
      />
      <View style={styles.grid}>
        {catalog.categories.map((category) => (
          <MiniCard
            key={category.id}
            style={styles.cell}
            glyph={categoryGlyph(category.name)}
            tone={categoryTone(category.name)}
            colorful
            title={category.name}
            onPress={() => navigation.navigate('MarketplaceCategory', {
              categoryId: category.id,
              categoryName: category.name,
            })}
          />
        ))}
        <MiniCard
          style={styles.cell}
          glyph="grid"
          tone="info"
          colorful
          title="View All"
          subtitle="Full catalog"
          onPress={() => navigation.navigate('MarketplaceCategory', {
            categoryId: '',
            categoryName: 'All products',
          })}
        />
      </View>

      <SectionHeader title="Featured Products" />
      {loading && !catalog.products.length ? <SkeletonStack rows={3} /> : null}
      {!loading && !featured.length ? (
        <EmptyState
          glyph="box"
          title="No products in the catalog"
          message="Live catalog items will appear here as soon as the company inventory is published."
        />
      ) : featured.map((product) => (
        <Card
          key={product.id}
          onPress={() => navigation.navigate('MarketplaceProduct', { productId: product.id, product })}
          accessibilityLabel={product.name}
        >
          <View style={styles.product}>
            <View style={[styles.thumb, { backgroundColor: colors.warningSurface, borderRadius: radius.chip }]}>
              <Glyph name="box" color={colors.warning} size={20} />
            </View>
            <View style={styles.copy}>
              <Text style={[type.small, { color: colors.textTertiary }]}>
                {[product.brand, product.category].filter(Boolean).join(' · ')}
              </Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '48%',
    minWidth: 140,
    flexGrow: 1,
  },
  product: {
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
