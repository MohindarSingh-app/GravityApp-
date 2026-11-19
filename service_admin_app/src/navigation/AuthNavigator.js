import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OTPVerificationScreen } from '../screens/auth/OTP/OTPVerificationScreen';
import { LoginScreen } from '../screens/auth/Login/LoginScreen';
import { RegisterScreen } from '../screens/auth/Register/RegisterScreen';
import { WelcomeScreen } from '../screens/auth/Welcome/WelcomeScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

/* First screen after splash is always Welcome (Get Started).
 * Login/Register/OTP open only when the user taps a button there. */
export function AuthNavigator() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack.Navigator initialRouteName="Welcome" screenOptions={screenOptions}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    </Stack.Navigator>
  );
}
