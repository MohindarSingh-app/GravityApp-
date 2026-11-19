import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../providers/AuthProvider';
import { apiService } from '../../services/api';
import { registerThemeStyles, theme } from '../../components/theme';
import { AuthHero } from '../../components/AuthHero';
import { AppButton } from '../../components/AppButton';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { UserRole } from '../../types';

interface RoleSelectScreenProps {
  route: {
    params: {
      mobile: string;
      roleSelectionToken: string;
      roles: Array<{ userId: number; role: UserRole; status: string; registrationId?: number | null }>;
    };
  };
  navigation: any;
}

const ROLE_META: Record<string, { icon: 'construct-outline' | 'build-outline' | 'hardware-chip-outline' | 'storefront-outline' | 'briefcase-outline'; title: string; sub: string }> = {
  service_partner: { icon: 'construct-outline', title: 'Service Partner', sub: 'On-site electrical, PLC, VFD and panel service visits' },
  repairing_partner: { icon: 'build-outline', title: 'Repairing Partner', sub: 'Workshop diagnostics and hardware repairs' },
  panel_maker: { icon: 'hardware-chip-outline', title: 'Panel Maker', sub: 'Panel manufacturing and fabrication projects' },
  supplier: { icon: 'storefront-outline', title: 'Supplier', sub: 'Products, inventory and marketplace sales' },
};

export const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({ route }) => {
  useUserPreferences();

  const { mobile, roleSelectionToken, roles } = route.params;
  const { login } = useAuth();
  const [selected, setSelected] = useState<UserRole | null>(roles[0]?.role || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const confirmRole = async () => {
    if (!selected) {
      setError('Select a role to continue');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiService.selectPartnerRole(roleSelectionToken, selected);
      const { token, refreshToken, user } = response.data || {};
      if (!token || !user) {
        setError('Invalid response from server');
        return;
      }
      await login(token, {
        id: user.id,
        mobile: user.mobile || mobile,
        email: user.email,
        role: user.role,
        status: user.status,
        token,
        refreshToken: refreshToken || '',
      });
      // RootNavigator swaps in the authenticated stack and opens Home.
      // Replacing Home here runs against the auth stack, which does not register that screen.
    } catch (selectError: any) {
      setError(selectError.response?.data?.message || 'Could not select this role. Request a new OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LoadingOverlay visible={loading} text="Switching workspace..." />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AuthHero
          title="Choose a workspace"
          subtitle={`Multiple partner roles are approved for ${mobile}. Select the role you want to work in.`}
        />
        <View style={styles.card}>
          {roles.map((account) => {
            const meta = ROLE_META[account.role] || { icon: 'briefcase-outline', title: account.role, sub: 'Partner workspace' };
            const active = selected === account.role;
            return (
              <TouchableOpacity
                key={`${account.userId}-${account.role}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(account.role)}
                style={[styles.roleCard, active && styles.roleCardActive]}
              >
                <View style={[styles.roleIcon, active && styles.roleIconActive]}>
                  <Ionicons name={meta.icon} size={20} color={active ? theme.colors.white : theme.colors.primary} />
                </View>
                <View style={styles.roleCopy}>
                  <Text style={styles.roleTitle}>{meta.title}</Text>
                  <Text style={styles.roleSub}>{meta.sub}</Text>
                </View>
                <View style={[styles.roleDot, active && styles.roleDotOn]} />
              </TouchableOpacity>
            );
          })}
          {error ? <ErrorMessage message={error} /> : null}
          <AppButton title="Continue" onPress={confirmRole} loading={loading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: theme.spacing.xl },
  card: {
    backgroundColor: theme.colors.mainCard,
    borderRadius: 24,
    padding: theme.spacing.xl,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    width: 'auto',
    maxWidth: 600,
    alignSelf: 'center',
    ...theme.elevation.card,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
  },
  roleCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  roleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryLight },
  roleIconActive: { backgroundColor: theme.colors.primary },
  roleCopy: { flex: 1 },
  roleTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700' },
  roleSub: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 2 },
  roleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    marginTop: 3,
  },
  roleDotOn: { borderColor: theme.colors.primary },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
