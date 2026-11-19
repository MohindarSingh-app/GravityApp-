import { useCallback, useState } from 'react';
import { Share, Text } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { marketplaceApi } from '../../../api/resources';
import { dialPhone, supportPhoneFromEnv } from '../../../constants/supportContact';
import { googleMapsUrl, openLiveMap, siteCoords } from '../../../utils/liveMap';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { LiveTrackCard, personFrom } from '../../../components/tracking/LiveTrackCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { money, orderLabel, orderTimeline } from './marketplaceView';

const SUPPORT_PHONE = supportPhoneFromEnv();

export function MarketplaceTrackingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, type } = useTheme();
  const orderId = route.params && route.params.orderId;
  const [order, setOrder] = useState((route.params && route.params.order) || null);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!orderId) {
      setError('This order could not be tracked.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const result = await marketplaceApi.order(orderId);
      setOrder(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function shareTracking() {
    if (!order) return;
    try {
      await Share.share({
        message: `Gravity Hub order ${orderLabel(order)} status: ${order.status}.`,
      });
      setNotice('Tracking link copied — share with your team');
    } catch (_error) {
      setError('Tracking could not be shared right now.');
    }
  }

  async function callPartner() {
    const phone = (order && (order.deliveryPhone || order.partnerPhone)) || SUPPORT_PHONE;
    try {
      await dialPhone(phone);
    } catch (err) {
      setError(getErrorMessage(err) || 'Unable to start the call.');
    }
  }

  async function openOrderMap() {
    setError('');
    try {
      const coords = siteCoords(order) || siteCoords(order && order.site) || siteCoords(order && order.shippingAddress);
      const label = (order && (order.siteName || order.shippingAddress)) || '';
      const text = typeof label === 'string' ? label : [label.siteName, label.address, label.city].filter(Boolean).join(', ');
      await openLiveMap({ coords, label: text });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (loading && !order) {
    return (
      <Screen header={<AppBar title="Track Order" onBack={() => navigation.goBack()} />}>
        <SkeletonStack rows={4} />
      </Screen>
    );
  }

  const partner = order && (order.deliveryPartner || order.partnerName);
  const dispatched = ['dispatched', 'shipped', 'out_for_delivery'].includes(String((order && order.status) || '').toLowerCase());
  const orderCoords = order ? (siteCoords(order) || siteCoords(order.site) || siteCoords(order.shippingAddress)) : null;
  const orderLabelText = order ? (typeof order.siteName === 'string' ? order.siteName : '') : '';
  const orderShipText = order && order.shippingAddress ? [order.shippingAddress.siteName, order.shippingAddress.address, order.shippingAddress.city].filter(Boolean).join(', ') : '';
  const orderMapLabel = orderShipText || orderLabelText || (order && order.siteName) || '';
  const orderMapUrl = (orderCoords || orderMapLabel) ? googleMapsUrl({ coords: orderCoords, label: orderMapLabel }) : '';

  return (
    <Screen
      header={(
        <AppBar
          title="Track Order"
          onBack={() => navigation.goBack()}
          right={order ? <StatusBadge label={order.status} status={order.status} /> : null}
        />
      )}
      headerColor={colors.background}
      refreshing={!loading}
      onRefresh={load}
    >
      <Banner message={error} />
      <Banner message={notice} tone="success" />
      {order ? (
        <>
          <LiveTrackCard
            etaLabel={order.etaLabel || (dispatched ? 'On the way' : 'Awaiting dispatch')}
            distanceLabel={order.distanceKm ? `${order.distanceKm} km away` : (order.siteName || 'Delivery site')}
            mapCoords={orderCoords || undefined}
            mapLabel={orderMapLabel || undefined}
            mapUrl={orderMapUrl || undefined}
            onOpenMap={openOrderMap}
            person={personFrom(
              partner || 'Delivery Partner',
              partner ? 'Delivery Partner' : 'A partner is assigned after the supplier marks this order ready for pickup.',
            )}
            title={orderLabel(order)}
            steps={orderTimeline(order)}
            notice="Your delivery partner will take a photo at pickup (from the supplier) and at drop-off, same as repair-ticket logistics."
            onCall={partner || SUPPORT_PHONE ? callPartner : undefined}
            onShare={shareTracking}
          />
          {(order.items || []).map((item) => (
            <Card key={item.id || item.sku}>
              <Text style={type.heading}>{item.name}</Text>
              <Text style={type.body}>{item.sku} · {item.quantity} × {money(item.unitPrice || item.price, order.currency)}</Text>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
