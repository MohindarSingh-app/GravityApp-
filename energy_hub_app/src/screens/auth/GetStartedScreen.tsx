import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React from 'react';
import { Image, ScrollView, StyleSheet, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerThemeStyles, theme } from '../../components/theme';
import { AppButton } from '../../components/AppButton';

interface GetStartedScreenProps {
  navigation: any;
}

export const GetStartedScreen: React.FC<GetStartedScreenProps> = ({ navigation }) => {
  useUserPreferences();

  const { height } = useWindowDimensions();
  const compact = height < 700;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.page} bounces={false} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <View style={styles.glow} />
        <View style={styles.logoPanel}>
        <Image
          accessibilityLabel="Gravity Hub logo"
          resizeMode="contain"
          source={require('../../assets/logo.png')}
          style={styles.logo}
        />
      </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>TRUSTED PARTNER NETWORK</Text>
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>EnergyHub · Field Services</Text>
        <Text style={styles.brandName}>EnergyHub</Text>
        <Text style={styles.tagline}>
          Your trusted partner for reliable energy services, field operations,
          and transparent partner compensation.
        </Text>
        <AppButton
          title="Get Started"
          onPress={() => navigation.navigate('Register')}
          variant="primary"
          fullWidth
        />
        <View style={styles.footerRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primaryBackground,
  },
  page: { flexGrow: 1 },
  hero: {
    minHeight: 360,
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroCompact: { minHeight: 285, paddingVertical: theme.spacing.lg },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -100, top: -120, backgroundColor: 'rgba(21,94,239,0.4)' },
  heroBadge: { alignSelf: 'center', marginTop: 18, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroBadgeText: { color: '#D7E4F5', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  logoPanel: {
    minHeight: 132,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    ...theme.elevation.medium,
  },
  logo: { width: '100%', maxWidth: 310, aspectRatio: 1882 / 836 },
  content: {
    minHeight: 320,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    justifyContent: 'center',
  },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: theme.spacing.xs,
  },
  brandName: {
    color: theme.colors.mainText,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: theme.spacing.xs,
  },
  tagline: {
    color: theme.colors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
    marginBottom: theme.spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  loginText: {
    color: theme.colors.secondaryText,
    fontSize: 14,
  },
  loginLink: {
    color: theme.colors.primaryAction,
    fontSize: 14,
    fontWeight: '600',
  },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
