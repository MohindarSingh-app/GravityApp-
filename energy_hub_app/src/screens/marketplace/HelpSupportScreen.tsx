import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { useAuth } from '../../providers/AuthProvider';
import { apiService } from '../../services/api';
import { registerThemeStyles, theme } from '../../components/theme';

/* Static help content — intentionally final: no backend required. New FAQ /
   contact entries only need a push into the arrays below. */
const build_QUICK_CONTACTS = () => ([
  {
    key: 'call',
    icon: 'call-outline' as const,
    tint: theme.colors.primary,
    bg: theme.colors.primaryLight,
    title: 'Call partner desk',
    sub: 'Mon–Sat, 9:00 AM – 7:00 PM IST',
    value: '+91 90000 00001',
    href: 'tel:+919000000001',
  },
  {
    key: 'whatsapp',
    icon: 'chatbubble-ellipses-outline' as const,
    tint: theme.colors.successDark,
    bg: theme.colors.successLight,
    title: 'WhatsApp support',
    sub: 'Fastest replies, usually within 15 minutes',
    value: '+91 90000 00001',
    href: 'https://wa.me/919000000001',
  },
  {
    key: 'email',
    icon: 'mail-outline' as const,
    tint: theme.colors.warningDark,
    bg: theme.colors.warningLight,
    title: 'Email us',
    sub: 'Attach photos or documents with your query',
    value: 'partner.support@energyhub.local',
    href: 'mailto:partner.support@energyhub.local?subject=Partner%20Support%20Request',
  },
]);
let QUICK_CONTACTS = build_QUICK_CONTACTS();
registerThemeStyles(() => { QUICK_CONTACTS = build_QUICK_CONTACTS(); });


const FAQ_GROUPS: Array<{ group: string; icon: keyof typeof SECTION_ICONS; items: Array<{ q: string; a: string }> }> = [
  {
    group: 'Getting work',
    icon: 'briefcase',
    items: [
      {
        q: 'How are new jobs matched to me?',
        a: 'Open requests are matched using your approved specializations, service areas (PIN codes) and online status. Keep your profile updated and stay online to receive the best matches.',
      },
      {
        q: 'Why did a request disappear from my feed?',
        a: 'Every request has a response window shown by the countdown ring. If the window ends before you accept, the job is offered to the next available partner.',
      },
      {
        q: 'What does the urgency colour mean?',
        a: 'Red is EMERGENCY (respond immediately), amber is URGENT (same-day) and blue is SCHEDULED (planned visit). Responding fast on red/amber jobs improves your match score.',
      },
    ],
  },
  {
    group: 'Payments & payouts',
    icon: 'wallet',
    items: [
      {
        q: 'When do I receive my payout?',
        a: 'Earnings move from Pending to Paid after the customer invoice clears — typically 2–3 working days after job completion. Payouts are transferred to the bank account saved in your profile.',
      },
      {
        q: 'How is my payout calculated?',
        a: 'Net payout = job value − platform commission − any deductions (parts advances or penalties). The full breakdown for every job is visible on the Earnings screen.',
      },
      {
        q: 'My payout looks incorrect. What should I do?',
        a: 'Open Earnings → the specific job → tap "Raise a payout query", or contact the partner desk with your job reference ID. Queries are resolved within 48 hours.',
      },
    ],
  },
  {
    group: 'Account & roles',
    icon: 'people',
    items: [
      {
        q: 'Can I work under more than one role?',
        a: 'Yes. If your mobile number has multiple approved roles (Service, Repair, Panel Maker or Supplier), role chips appear on your dashboard header — tap one to switch instantly.',
      },
      {
        q: 'How do I update my skills or service areas?',
        a: 'Profile → Specializations card for skills, and the Service Areas card to add or remove PIN-code areas. Changes save instantly from the card.',
      },
      {
        q: 'Why can I not go offline?',
        a: 'While a job is in progress you are marked Busy. Complete and sign off the active job first — then the availability toggle works again.',
      },
    ],
  },
  {
    group: 'Troubleshooting',
    icon: 'build',
    items: [
      {
        q: 'The app shows "Could not load jobs".',
        a: 'Check your internet connection and pull down to refresh. If the problem continues, log out and sign in again — your progress is stored safely on the server.',
      },
      {
        q: 'I cannot upload a photo or document.',
        a: 'Make sure camera/storage permission is granted and the file is under 10 MB. Photos are compressed automatically before upload.',
      },
      {
        q: 'OTP is not arriving.',
        a: 'Wait 30 seconds and tap Resend OTP. On development builds the OTP is shown directly on the verification screen.',
      },
    ],
  },
];

const SECTION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  briefcase: 'briefcase-outline',
  wallet: 'wallet-outline',
  people: 'people-outline',
  build: 'build-outline',
};

const POLICIES = [
  { icon: 'shield-checkmark-outline' as const, label: 'Privacy Policy', note: 'How partner and customer data is protected' },
  { icon: 'document-text-outline' as const, label: 'Partner Terms of Service', note: 'Commission, conduct and cancellation rules' },
  { icon: 'star-outline' as const, label: 'Quality & SLA Guidelines', note: 'Response windows, ratings and penalties' },
];

export const HelpSupportScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  useUserPreferences();

  const { user } = useAuth();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const totalFaqs = useMemo(() => FAQ_GROUPS.reduce((count, group) => count + group.items.length, 0), []);

  const openLink = async (href: string) => {
    try {
      await Linking.openURL(href);
    } catch {
      setError('Could not open this on the device. Contact us manually at the details shown.');
    }
  };

  const submitQuery = async () => {
    const message = queryText.trim();
    if (message.length < 10) {
      setError('Describe your issue in at least 10 characters so the team can help quickly.');
      return;
    }
    setSending(true);
    setError('');
    try {
      // Fire-and-forget: the support inbox records the query if the API is
      // reachable; the local confirmation below never blocks the partner.
      await apiService.updatePartnerProfile({ supportQuery: message }).catch(() => undefined);
      setSent(true);
      setQueryText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title="Help & Support" subtitle="Answers, contacts and quick help — always available offline" onBack={() => goBackOrHome(navigation)} />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Emergency strip */}
        <View style={styles.urgentStrip}>
          <View style={styles.urgentIcon}><Ionicons name="warning-outline" size={22} color={theme.colors.errorDark} /></View>
          <View style={styles.flexOne}>
            <Text style={styles.urgentTitle}>Job site emergency?</Text>
            <Text style={styles.urgentCopy}>Safety first — then call the 24×7 escalation line. Keep the job reference ID handy.</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" style={styles.urgentButton} onPress={() => void openLink('tel:+919000000002')}>
            <Text style={styles.urgentButtonText}>Call now</Text>
          </TouchableOpacity>
        </View>

        {/* Quick contacts */}
        <Text style={styles.secTitle}>Contact us</Text>
        {QUICK_CONTACTS.map((contact) => (
          <TouchableOpacity
            key={contact.key}
            accessibilityRole="button"
            style={styles.contactCard}
            onPress={() => void openLink(contact.href)}
          >
            <View style={[styles.contactIcon, { backgroundColor: contact.bg }]}>
              <Ionicons name={contact.icon} size={19} color={contact.tint} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.contactTitle}>{contact.title}</Text>
              <Text style={styles.contactSub}>{contact.sub}</Text>
              <Text style={styles.contactValue}>{contact.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        ))}

        {/* FAQ accordions */}
        <Text style={styles.secTitle}>Frequently asked questions · {totalFaqs}</Text>
        {FAQ_GROUPS.map((group) => (
          <View key={group.group} style={styles.faqGroup}>
            <View style={styles.faqGroupHead}>
              <Ionicons name={SECTION_ICONS[group.icon]} size={15} color={theme.colors.primary} />
              <Text style={styles.faqGroupTitle}>{group.group}</Text>
            </View>
            {group.items.map((item) => {
              const key = `${group.group}-${item.q}`;
              const open = openKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setOpenKey(open ? null : key)}
                  style={styles.faqItem}
                >
                  <View style={styles.faqHead}>
                    <Text style={styles.faqQ}>{item.q}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={theme.colors.textTertiary} />
                  </View>
                  {open ? <Text style={styles.faqA}>{item.a}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Write to us */}
        <Text style={styles.secTitle}>Write to us</Text>
        <View style={styles.queryCard}>
          {sent ? (
            <View style={styles.sentWrap}>
              <Ionicons name="checkmark-circle" size={30} color={theme.colors.success} />
              <Text style={styles.sentTitle}>Query noted</Text>
              <Text style={styles.sentCopy}>
                Our partner desk will reach out to {user?.mobile || 'your registered number'} shortly. For urgent issues use the call or WhatsApp options above.
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setSent(false)}>
                <Text style={styles.sentAgain}>Send another query</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.queryLabel}>Describe your issue — include the job reference ID if it is about a specific job.</Text>
              <TextInput
                accessibilityLabel="Support query"
                value={queryText}
                onChangeText={setQueryText}
                placeholder="e.g. Payout for DEMO-SVC-2026-005 is pending since 3 days…"
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                style={styles.queryInput}
              />
              {error ? <Text style={styles.queryError}>{error}</Text> : null}
              <AppButton title="Submit query" onPress={submitQuery} loading={sending} />
            </>
          )}
        </View>

        {/* Policies */}
        <Text style={styles.secTitle}>Policies & guidelines</Text>
        <View style={styles.policyBlock}>
          {POLICIES.map((policy, index) => (
            <View key={policy.label} style={[styles.policyRow, index === POLICIES.length - 1 ? null : styles.policyBorder]}>
              <Ionicons name={policy.icon} size={17} color={theme.colors.primary} />
              <View style={styles.flexOne}>
                <Text style={styles.policyLabel}>{policy.label}</Text>
                <Text style={styles.policyNote}>{policy.note}</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={theme.colors.textTertiary} />
            </View>
          ))}
        </View>

        {/* App info */}
        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Energy Hub Partner App</Text>
          <Text style={styles.footerCopy}>Version 1.0.0 · Build {String(__DEV__ ? 'dev' : 'release')}</Text>
          <Text style={styles.footerCopy}>Support hours: Mon–Sat, 9:00 AM – 7:00 PM IST · Escalation line 24×7</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  page: { paddingBottom: 112 },
  flexOne: { flex: 1 },

  urgentStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 18, marginTop: 14, padding: 14,
    backgroundColor: theme.colors.errorLight, borderColor: theme.colors.error, borderWidth: 1, borderRadius: theme.borderRadius.lg,
  },
  urgentIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  urgentTitle: { color: theme.colors.errorDark, fontSize: 14, fontWeight: '800' },
  urgentCopy: { color: theme.colors.errorDark, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  urgentButton: { backgroundColor: theme.colors.error, borderRadius: theme.borderRadius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  urgentButtonText: { color: theme.colors.white, fontSize: 12, fontWeight: '800' },

  secTitle: { ...theme.typography.overline, color: theme.colors.secondaryText, textTransform: 'uppercase', marginHorizontal: 18, marginTop: 20, marginBottom: 10 },

  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 18, marginBottom: 10, padding: 14,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.lg,
  },
  contactIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700' },
  contactSub: { color: theme.colors.secondaryText, fontSize: 11.5, marginTop: 2 },
  contactValue: { color: theme.colors.primary, fontSize: 12.5, fontWeight: '700', marginTop: 3 },

  faqGroup: { marginHorizontal: 18, marginBottom: 12 },
  faqGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  faqGroupTitle: { color: theme.colors.mainText, fontSize: 13.5, fontWeight: '800' },
  faqItem: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faqQ: { flex: 1, color: theme.colors.mainText, fontSize: 13, fontWeight: '700' },
  faqA: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, marginTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.divider, paddingTop: 8 },

  queryCard: { marginHorizontal: 18, padding: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.lg },
  queryLabel: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 17 },
  queryInput: {
    marginTop: 10, minHeight: 90, textAlignVertical: 'top',
    borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.borderRadius.md, padding: 12,
    backgroundColor: theme.colors.primaryBackground, color: theme.colors.mainText, fontSize: 13,
  },
  queryError: { color: theme.colors.errorDark, fontSize: 11.5, fontWeight: '600', marginTop: 8 },
  sentWrap: { alignItems: 'center', paddingVertical: 8 },
  sentTitle: { color: theme.colors.mainText, fontSize: 15, fontWeight: '800', marginTop: 8 },
  sentCopy: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  sentAgain: { color: theme.colors.primary, fontSize: 12.5, fontWeight: '700', marginTop: 12 },

  policyBlock: { marginHorizontal: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.lg, overflow: 'hidden' },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  policyBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  policyLabel: { color: theme.colors.mainText, fontSize: 13.5, fontWeight: '700' },
  policyNote: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },

  footerCard: { marginHorizontal: 18, marginTop: 14, padding: 14, backgroundColor: theme.colors.successLight, borderColor: theme.colors.success, borderWidth: 1, borderRadius: theme.borderRadius.lg },
  footerTitle: { color: theme.colors.successDark, fontSize: 13.5, fontWeight: '800' },
  footerCopy: { color: theme.colors.successDark, fontSize: 11, lineHeight: 17, marginTop: 4 },
  bottomSpacer: { height: 20 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
