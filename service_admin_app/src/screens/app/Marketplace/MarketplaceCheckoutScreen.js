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
import { Card } from '../../../components/ui/Card';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { money } from './marketplaceView';
import { useMarketplaceCart } from './useMarketplaceCart';

export function MarketplaceCheckoutScreen() {
  const navigation = useNavigation();
  const { colors, radius, type } = useTheme();
  const { cart, busy, error, setError } = useMarketplaceCart();
  const { sites, loading: sitesLoading, error: sitesError, reload: reloadSites } = useCompanySites();
  const [selectedSite, setSelectedSite] = useState('');
  const [placing, setPlacing] = useState(false);

  const siteId = selectedSite || (sites.find((site) => site.isPrimary) || sites[0] || {}).id || '';

  useFocusEffect(useCallback(() => {
    reloadSites();
  }, [reloadSites]));

  async function placeOrder() {
    if (!siteId) {
      setError('Select a delivery site to continue.');
      return;
    }
    setPlacing(true);
    setError('');
    try {
      const result = await marketplaceApi.checkout({
        siteId,
        paymentMode: 'sandbox',
      });
      navigation.replace('MarketplaceConfirmed', { result, siteId });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Screen
      header={<AppBar title="Checkout" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
    >
      <Banner message={error || sitesError} />
      <Text style={[type.label, { color: colors.text }]}>Delivery Address</Text>
      {sitesLoading ? <Text style={type.muted}>Loading company sites…</Text> : null}
      {!sitesLoading && !sites.length ? (
        <EmptyState title="No delivery sites found" message="Add an active company site in Profile before checkout." />
      ) : sites.map((site) => {
        const selected = siteId === site.id;
        return (
          <Pressable
            key={site.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => setSelectedSite(site.id)}
          >
            <Card style={selected ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
              <View style={styles.site}>
                <View style={[styles.siteIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.chip }]}>
                  <Glyph name="plant" color={colors.primary} size={18} />
                </View>
                <View style={styles.copy}>
                  <Text style={type.heading}>{site.siteName}{site.isPrimary ? ' · Primary' : ''}</Text>
                  <Text style={type.small}>{[site.fullAddress || site.address, site.city, site.state].filter(Boolean).join(', ')}</Text>
                </View>
                <View style={[
                  styles.check,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                >
                  {selected ? <Glyph name="check" color={colors.textOnPrimary} size={12} /> : null}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
      <Button
        title="+ Add New Site"
        variant="secondary"
        onPress={() => {
          const parent = navigation.getParent();
          if (parent) parent.navigate('SitesList');
        }}
      />

      <Text style={[type.label, { color: colors.text }]}>Order Summary</Text>
      <Card>
        {cart.items.map((item) => (
          <View key={item.productId} style={styles.summary}>
            <Text style={[type.body, styles.copy]}>{item.name} × {item.quantity}</Text>
            <Text style={type.heading}>{money(item.price * item.quantity, item.currency)}</Text>
          </View>
        ))}
        <View style={styles.summary}>
          <Text style={type.heading}>Total</Text>
          <Text style={[type.heading, { color: colors.accentText }]}>{money(cart.subtotal, cart.currency)}</Text>
        </View>
      </Card>

      <Text style={[type.label, { color: colors.text }]}>Payment</Text>
      <Banner
        tone="warning"
        message="Placeholder payment step. Real payment collection and supplier payout are a separate task — this button simulates a successful payment for demo purposes only."
      />
      <Button
        title="Pay & Place Order (Mock)"
        variant="success"
        loading={placing || busy}
        disabled={!cart.items.length || sitesLoading || !sites.length}
        onPress={placeOrder}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  site: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  siteIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
});
