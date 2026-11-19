import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketplaceCartScreen } from '../screens/app/Marketplace/MarketplaceCartScreen';
import { MarketplaceCategoryScreen } from '../screens/app/Marketplace/MarketplaceCategoryScreen';
import { MarketplaceCheckoutScreen } from '../screens/app/Marketplace/MarketplaceCheckoutScreen';
import { MarketplaceConfirmedScreen } from '../screens/app/Marketplace/MarketplaceConfirmedScreen';
import { MarketplaceHomeScreen } from '../screens/app/Marketplace/MarketplaceHomeScreen';
import { MarketplaceOrdersScreen } from '../screens/app/Marketplace/MarketplaceOrdersScreen';
import { MarketplaceProductScreen } from '../screens/app/Marketplace/MarketplaceProductScreen';
import { MarketplaceTrackingScreen } from '../screens/app/Marketplace/MarketplaceTrackingScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

export function MarketplaceNavigator() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack.Navigator initialRouteName="MarketplaceHome" screenOptions={screenOptions}>
      <Stack.Screen name="MarketplaceHome" component={MarketplaceHomeScreen} />
      <Stack.Screen name="MarketplaceCategory" component={MarketplaceCategoryScreen} />
      <Stack.Screen name="MarketplaceProduct" component={MarketplaceProductScreen} />
      <Stack.Screen name="MarketplaceCart" component={MarketplaceCartScreen} />
      <Stack.Screen name="MarketplaceCheckout" component={MarketplaceCheckoutScreen} />
      <Stack.Screen name="MarketplaceConfirmed" component={MarketplaceConfirmedScreen} />
      <Stack.Screen name="MarketplaceOrders" component={MarketplaceOrdersScreen} />
      <Stack.Screen name="MarketplaceTracking" component={MarketplaceTrackingScreen} />
    </Stack.Navigator>
  );
}
