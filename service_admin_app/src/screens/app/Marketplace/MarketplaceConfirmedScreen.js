import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppBar } from '../../../components/AppBar';
import { Button } from '../../../components/Button';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { money } from './marketplaceView';

export function MarketplaceConfirmedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, radius, type } = useTheme();
  const result = (route.params && route.params.result) || {};
  const order = result.order || result;
  const orderId = order.orderNumber || order.id || result.orderId || 'Pending';
  const total = order.total || result.total || (result.payment && result.payment.amount);
  const siteName = order.siteName
    || (order.shippingAddress && order.shippingAddress.siteName)
    || 'Selected site';

  function goDashboard() {
    const parent = navigation.getParent();
    if (parent) parent.navigate('Dashboard');
    else navigation.navigate('Dashboard');
  }

  return (
    <Screen header={<AppBar title="Order Placed" onBack={goDashboard} />} headerColor={colors.background}>
      <View style={styles.wrap}>
        <View style={[styles.icon, { backgroundColor: colors.successSurface, borderRadius: radius.pill }]}>
          <Glyph name="box" color={colors.success} size={28} />
        </View>
        <Text style={[type.display, { color: colors.text, textAlign: 'center' }]}>Order Placed!</Text>
        <Text style={[type.body, { color: colors.textSecondary, textAlign: 'center' }]}>
          Order ID: {typeof orderId === 'string' && orderId.startsWith('#') ? orderId : `#${orderId}`}
        </Text>
        <Text style={[type.small, { color: colors.textSecondary, textAlign: 'center' }]}>
          Your supplier has been notified and will confirm shortly
        </Text>
      </View>
      <Card>
        <View style={styles.row}>
          <Text style={[type.small, { color: colors.textTertiary }]}>Total Paid</Text>
          <Text style={[type.heading, { color: colors.success }]}>{money(total, order.currency || 'INR')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[type.small, { color: colors.textTertiary }]}>Delivery To</Text>
          <Text style={type.heading}>{siteName}</Text>
        </View>
        {result.payment && result.payment.reference ? (
          <Text style={[type.small, { color: colors.warning }]}>
            Sandbox reference: {result.payment.reference}
          </Text>
        ) : null}
      </Card>
      <View style={styles.actions}>
        <View style={styles.cell}>
          <Button title="Dashboard" variant="success" onPress={goDashboard} />
        </View>
        <View style={styles.cell}>
          <Button title="My Orders" variant="outline" onPress={() => navigation.replace('MarketplaceOrders')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  icon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
  },
});
