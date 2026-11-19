import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { marketplaceApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { money } from './marketplaceView';
import { useMarketplaceCart } from './useMarketplaceCart';

export function MarketplaceCartScreen() {
  const navigation = useNavigation();
  const { colors, radius, type } = useTheme();
  const { cart, busy, error, update } = useMarketplaceCart();

  return (
    <Screen
      header={<AppBar title="Cart" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
    >
      <Banner message={error} />
      {cart.currencyConflict ? (
        <Banner message="Cart items use different currencies. Remove items until one currency remains before checkout." tone="warning" />
      ) : null}
      {!cart.items.length ? (
        <EmptyState
          glyph="cart"
          title="Your cart is empty"
          message="Browse products and add the parts you need."
          action={<Button title="Browse Products" variant="outline" onPress={() => navigation.navigate('MarketplaceHome')} />}
        />
      ) : (
        <>
          {cart.items.map((item) => (
            <Card key={item.productId} style={styles.item}>
              <View style={styles.copy}>
                <Text style={[type.small, { color: colors.textTertiary }]}>{item.sku}</Text>
                <Text style={type.heading}>{item.name}</Text>
                <Text style={type.body}>{money(item.price, item.currency)} / {item.unit}</Text>
                <Text style={type.small}>{item.stockQuantity} available</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove one ${item.name}`}
                  disabled={busy}
                  onPress={() => update(() => marketplaceApi.setCartItemQuantity(item.productId, item.quantity - 1))}
                  style={[styles.step, { borderColor: colors.border, borderRadius: radius.sm }]}
                >
                  <Glyph name="minus" color={colors.text} size={16} />
                </Pressable>
                <Text style={type.heading}>{item.quantity}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add one ${item.name}`}
                  disabled={busy || item.quantity >= item.stockQuantity || item.quantity >= 99}
                  onPress={() => update(() => marketplaceApi.setCartItemQuantity(item.productId, item.quantity + 1))}
                  style={[styles.step, { borderColor: colors.border, borderRadius: radius.sm }]}
                >
                  <Glyph name="plus" color={colors.text} size={16} />
                </Pressable>
              </View>
            </Card>
          ))}
          <Card>
            {cart.currencyConflict ? null : (
              <View style={styles.summary}>
                <Text style={[type.small, { color: colors.textTertiary }]}>Subtotal</Text>
                <Text style={[type.heading, { color: colors.text }]}>{money(cart.subtotal, cart.currency)}</Text>
              </View>
            )}
            <View style={styles.summary}>
              <Text style={[type.small, { color: colors.textTertiary }]}>Delivery</Text>
              <Text style={[type.heading, { color: colors.success }]}>Calculated at checkout</Text>
            </View>
          </Card>
          <Button disabled={busy || Boolean(cart.currencyConflict)} title="Checkout" onPress={() => navigation.navigate('MarketplaceCheckout')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  step: {
    width: 32,
    height: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});
