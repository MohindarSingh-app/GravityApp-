import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { marketplaceApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { EmptyState } from '../../../components/EmptyState';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { JobCard } from '../../../components/ui/JobCard';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { money, orderLabel, orderTitle } from './marketplaceView';

export function MarketplaceOrdersScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await marketplaceApi.orders();
      setOrders(result.orders || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  return (
    <Screen
      header={<AppBar title="My Orders" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
      refreshing={!loading}
      onRefresh={() => { setLoading(true); load(); }}
    >
      <Banner message={error} />
      {loading && !orders.length ? <SkeletonStack rows={3} /> : null}
      {!loading && !orders.length ? (
        <EmptyState
          glyph="box"
          title="No orders yet"
          message="Completed marketplace orders will appear here."
        />
      ) : orders.map((order) => (
        <JobCard
          key={order.id}
          title={orderTitle(order)}
          code={`${orderLabel(order)} · ${new Date(order.createdAt).toLocaleDateString()}`}
          status={order.status}
          statusLabel={order.status}
          technician={[order.supplier, money(order.total, order.currency)].filter(Boolean).join(' · ')}
          location={order.siteName}
          onPress={() => navigation.navigate('MarketplaceTracking', { orderId: order.id, order })}
        />
      ))}
    </Screen>
  );
}
