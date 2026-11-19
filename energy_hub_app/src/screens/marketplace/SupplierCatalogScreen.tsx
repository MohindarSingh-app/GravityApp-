import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { apiService } from '../../services/api';
import { SupplierProduct } from './SupplierProductFormScreen';

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'out_of_stock', label: 'Out of stock' },
  { key: 'delisted', label: 'Delisted' },
];

interface SupplierCatalogScreenProps {
  navigation: any;
}

export const SupplierCatalogScreen: React.FC<SupplierCatalogScreenProps> = ({ navigation }) => {
  const { colors } = useUserPreferences();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.listMyProducts(filter === 'all' ? undefined : { status: filter });
      setProducts(response.data || []);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load supplier products.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    void loadProducts();
  }, [loadProducts]));

  const renderProduct = ({ item }: { item: SupplierProduct }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.name}`}
      onPress={() => navigation.navigate('SupplierProductForm', { product: item })}
      style={[styles.productRow, { borderColor: colors.border }]}
    >
      <View style={styles.productMain}>
        <Text style={[styles.productName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.productMeta, { color: colors.secondaryText }]}>{[item.brand, item.category].filter(Boolean).join(' · ')}</Text>
        <Text style={[styles.stockLine, { color: colors.secondaryText }]}>{item.stock || 0} in stock · {item.status?.replaceAll('_', ' ') || 'active'}</Text>
      </View>
      <Text style={[styles.productPrice, { color: colors.primary }]}>₹{Number(item.price || 0).toLocaleString('en-IN')}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Product catalog" subtitle="Keep your supplier listings current" onBack={() => goBackOrHome(navigation)} />
      <View style={styles.topActions}>
        <Text style={[styles.count, { color: colors.secondaryText }]}>{products.length} products</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SupplierProductForm')}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.addButtonText}>+ Add product</Text>
        </Pressable>
      </View>
      <View style={styles.filters}>
        {STATUSES.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === item.key }}
            onPress={() => setFilter(item.key)}
            style={[
              styles.filter,
              { borderColor: filter === item.key ? colors.primary : colors.border, backgroundColor: filter === item.key ? colors.primaryLight : colors.surface },
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.filterText, { color: filter === item.key ? colors.primary : colors.secondaryText }]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => { void loadProducts(); }} style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
          <Text style={[styles.retry, { color: colors.primary }]}>Tap to retry</Text>
        </Pressable>
      ) : null}
      {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          contentContainerStyle={products.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.secondaryText }]}>No products match this filter.</Text>}
        />
      )}
    </View>
  );
};

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  topActions: { paddingHorizontal: theme.spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  count: { fontSize: 13 },
  addButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: theme.borderRadius.sm },
  addButtonText: { color: theme.colors.white, fontWeight: '700', fontSize: 13 },
  filters: { paddingHorizontal: theme.spacing.lg, flexDirection: 'row', gap: 6, paddingBottom: 12 },
  filter: { flex: 1, height: 44, paddingHorizontal: 4, borderRadius: theme.borderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  productRow: { paddingVertical: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  productMain: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700' },
  productMeta: { fontSize: 12, marginTop: 4 },
  stockLine: { fontSize: 11, marginTop: 5, textTransform: 'capitalize' },
  productPrice: { fontSize: 15, fontWeight: '700' },
  empty: { textAlign: 'center', padding: 24 },
  loader: { marginTop: 60 },
  errorCard: { marginHorizontal: theme.spacing.lg, padding: theme.spacing.md },
  error: { color: theme.colors.error, fontSize: 13 },
  retry: { fontSize: 12, fontWeight: '700', marginTop: 5 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
