import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

export const JobCompletedScreen: React.FC<{ navigation: any; route: { params: any } }> = ({ navigation, route }) => {
  const { colors } = useUserPreferences();
  const { referenceId, totalBill, payoutAmount, serviceCharge, partsTotal } = route.params;
  const formatMoney = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.successCard}>
          <View style={styles.checkCircle}><Text style={styles.checkText}>✓</Text></View>
          <Text style={styles.title}>Job Completed!</Text>
          <Text style={styles.subtitle}>{referenceId ? `#${referenceId}` : 'Job'} · GST invoice sent to customer</Text>
        </View>

        <View style={styles.breakdownCard}>
          <View style={styles.row}><Text style={styles.label}>Service Charge</Text><Text style={styles.value}>{formatMoney(serviceCharge)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Spare Parts</Text><Text style={styles.value}>{formatMoney(partsTotal)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Total Bill</Text><Text style={styles.valueTotal}>{formatMoney(totalBill)}</Text></View>
          <View style={[styles.row, styles.lastRow]}><Text style={styles.label}>Your Payout</Text><Text style={styles.valuePayout}>{formatMoney(payoutAmount)}</Text></View>
        </View>

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  page: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112 },
  successCard: { alignItems: 'center', marginTop: theme.spacing.lg, marginBottom: theme.spacing.xl },
  checkCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  checkText: { color: theme.colors.success, fontSize: 32 },
  title: { color: theme.colors.mainText, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: theme.colors.secondaryText, fontSize: 14, textAlign: 'center' },
  breakdownCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  lastRow: { borderBottomWidth: 0 },
  label: { color: theme.colors.secondaryText, fontSize: 14 },
  value: { color: theme.colors.mainText, fontSize: 15, fontWeight: '700' },
  valueTotal: { color: theme.colors.mainText, fontSize: 16, fontWeight: '800' },
  valuePayout: { color: theme.colors.successDark, fontSize: 16, fontWeight: '800' },
  backButton: { marginTop: theme.spacing.lg, backgroundColor: theme.colors.error, borderRadius: theme.borderRadius.md, paddingVertical: 16, alignItems: 'center' },
  backText: { color: theme.colors.textInverse, fontSize: 16, fontWeight: '700' },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
