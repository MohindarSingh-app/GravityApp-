import { useNavigation } from '@react-navigation/native';
import { AuthCanvas, AuthSwitch } from '../../../components/AuthCanvas';
import { Button } from '../../../components/Button';

export function WelcomeScreen() {
  const navigation = useNavigation();

  return (
    <AuthCanvas
      variant="welcome"
      kicker="INDUSTRIAL ELECTRICAL SERVICES"
      headline="Your factory’s electrical command center."
      detail="Emergency response in 30 minutes. Certified engineers, AMC contracts, compliance and a B2B parts marketplace — one app."
    >
      <Button title="Get Started" pill onPress={() => navigation.navigate('Register')} />
      <AuthSwitch
        lead="Already registered?"
        action="Sign In"
        onPress={() => navigation.navigate('Login')}
      />
    </AuthCanvas>
  );
}
