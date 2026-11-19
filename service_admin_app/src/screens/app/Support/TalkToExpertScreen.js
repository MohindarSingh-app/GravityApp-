import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { DatePickerField } from '../../../components/DatePickerField';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { supportApi } from '../../../api/resources';
import { dialPhone, supportPhoneFromEnv } from '../../../constants/supportContact';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import Config from 'react-native-config';
import { getErrorMessage } from '../../../utils/errors';

const CALL_NUMBER = supportPhoneFromEnv();
const WHATSAPP_NUMBER = String(Config.EXPO_PUBLIC_SUPPORT_WHATSAPP || CALL_NUMBER)
  .replace(/[^\d]/g, '');
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi Gravity Hub, I need help')}`;

const HELP_TOPICS = [
  { glyph: 'bolt', label: 'Electrical & Panels' },
  { glyph: 'chip', label: 'PLC / SCADA / HMI' },
  { glyph: 'speed', label: 'VFD / Servo Drive' },
  { glyph: 'wrench', label: 'VFD Programming' },
  { glyph: 'document', label: 'AMC & Audits' },
  { glyph: 'cable', label: 'Cabling & Wiring' },
];

const CALL_TOPICS = [
  'Electrical / Panel issue',
  'PLC / HMI / SCADA',
  'VFD / Servo Drive',
  'VFD Programming',
  'Cabling',
  'Repair Center',
  'AMC & contracts',
  'Compliance / Audit',
  'Not sure — general help',
];

const CALLBACK_TOPICS = [
  'Electrical / Panel',
  'PLC / HMI / SCADA',
  'VFD / Servo Drive',
  'VFD Programming',
  'AMC / Compliance',
  'General help',
];

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function TopicChip({ label, active, onPress, colors, radius }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.topicChip, { borderRadius: radius.pill, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.cardSoft }]}
    >
      <Text style={[styles.topicChipText, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

export function TalkToExpertScreen() {
  const navigation = useNavigation();
  const scrollRef = useRef(null);
  const { user } = useAuth();
  const { colors, type, radius, space } = useTheme();

  const [step, setStep] = useState('menu'); // menu | call | callback | submitted
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(false);

  const [callTopic, setCallTopic] = useState('');
  const [callbackTopic, setCallbackTopic] = useState('');
  const [callbackPhone, setCallbackPhone] = useState(user?.phone || '');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [callbackNote, setCallbackNote] = useState('');
  const [reference, setReference] = useState('');

  useFocusEffect(useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false });
  }, []));

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false });
  }, [step]);

  function goBack() {
    if (step === 'menu') navigation.goBack();
    else setStep('menu');
  }

  async function openWhatsApp() {
    setError('');
    try {
      await Linking.openURL(WHATSAPP_URL);
    } catch (err) {
      setError('WhatsApp could not be opened on this device.');
    }
  }

  async function callNow() {
    setError('');
    if (!callTopic) {
      setError('Choose a topic first so we can connect you to the right specialist.');
      return;
    }
    try {
      await dialPhone(CALL_NUMBER);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function openCallback() {
    setError('');
    setSuccess('');
    setStep('callback');
  }

  async function submitCallback() {
    if (sending) return;
    const phone = callbackPhone.trim().replace(/[^\d+]/g, '');
    const phoneDigits = phone.replace(/\D/g, '').length;
    if (phoneDigits < 10 || phoneDigits > 15) {
      setError('Enter a valid phone number with 10 to 15 digits.');
      return;
    }
    if (!callbackTopic) {
      setError('Choose a topic for your callback.');
      return;
    }
    if (!callbackDate) {
      setError('Choose a preferred callback date.');
      return;
    }
    if (!validTime(callbackTime)) {
      setError('Enter the preferred time in 24-hour format, for example 14:30.');
      return;
    }
    setError('');
    setSending(true);
    try {
      const body = [
        `Callback requested for ${phone}.`,
        `Topic: ${callbackTopic}`,
        `Preferred: ${callbackDate} at ${callbackTime}`,
        callbackNote.trim() ? `Details: ${callbackNote.trim()}` : null,
      ].filter(Boolean).join('\n');

      const result = await supportApi.create({
        subject: 'Expert callback request',
        message: body,
      });
      setReference(result.request?.id || 'CB');
      setSending(false);
      setStep('submitted');
    } catch (err) {
      setError(getErrorMessage(err));
      setSending(false);
    }
  }

  const titles = {
    menu: 'Talk to Expert',
    call: 'Call Gravity Hub Expert',
    callback: 'Request Callback',
    submitted: 'Callback Scheduled',
  };

  const showBack = step !== 'menu';

  return (
    <Screen
      headerColor={colors.background}
      statusBarStyle="dark-content"
      contentGap={space.md}
      scrollRef={scrollRef}
      header={(
        <AppBar
          title={titles[step]}
          onBack={showBack ? goBack : undefined}
        />
      )}
    >
      <Banner message={error} tone="error" />
      <Banner message={success} tone="success" />

      {step === 'menu' ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft }]}>
              <Glyph name="call" color={colors.primary} size={26} />
              <View style={styles.heroCopy}>
                <Text style={[type.label, { color: colors.primary }]}>How can we help?</Text>
                <Text style={[type.small, { color: colors.textSecondary }]}>Free consultation · no obligation</Text>
              </View>
            </View>

            <Text style={[type.section, { color: colors.text }]}>Choose how you want to connect</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setStep('call')}
              style={[styles.connectRow, { backgroundColor: colors.cardSoft, borderRadius: radius.md }]}
            >
              <Glyph name="call" color={colors.primary} size={20} />
              <View style={styles.connectCopy}>
                <Text style={[type.label, { color: colors.text }]}>Call Gravity Hub Expert</Text>
                <Text style={[type.small, { color: colors.textTertiary }]}>Instant call · average pickup in 2 min</Text>
              </View>
              <Glyph name="chevron" color={colors.textTertiary} size={16} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={openWhatsApp}
              style={[styles.connectRow, { backgroundColor: colors.cardSoft, borderRadius: radius.md }]}
            >
              <Glyph name="whatsapp" color="#25D366" size={20} />
              <View style={styles.connectCopy}>
                <Text style={[type.label, { color: colors.text }]}>WhatsApp Chat</Text>
                <Text style={[type.small, { color: colors.textTertiary }]}>Send a message · reply within 15 min</Text>
              </View>
              <Glyph name="chevron" color={colors.textTertiary} size={16} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('HelpSupport')}
              style={[styles.connectRow, { backgroundColor: colors.cardSoft, borderRadius: radius.md }]}
            >
              <Glyph name="spark" color={colors.primary} size={20} />
              <View style={styles.connectCopy}>
                <Text style={[type.label, { color: colors.text }]}>Ask Gravity Hub AI (Instant)</Text>
                <Text style={[type.small, { color: colors.textTertiary }]}>Instant suggestions for error codes &amp; issues</Text>
              </View>
              <Glyph name="chevron" color={colors.textTertiary} size={16} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={openCallback}
              style={[styles.connectRow, { backgroundColor: colors.cardSoft, borderRadius: radius.md }]}
            >
              <Glyph name="calendar" color={colors.primary} size={20} />
              <View style={styles.connectCopy}>
                <Text style={[type.label, { color: colors.text }]}>Request a Callback</Text>
                <Text style={[type.small, { color: colors.textTertiary }]}>Pick a time that works for you</Text>
              </View>
              <Glyph name="chevron" color={colors.textTertiary} size={16} />
            </Pressable>

            <Text style={[type.section, styles.sectionGap, { color: colors.text }]}>Experts can help with</Text>
            <View style={styles.topicGrid}>
              {HELP_TOPICS.map((topic) => (
                <View key={topic.label} style={[styles.topicCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.md }]}>
                  <Glyph name={topic.glyph} color={colors.primary} size={18} />
                  <Text style={[type.small, styles.topicCardText, { color: colors.text }]}>{topic.label}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.successSurface, borderColor: colors.success, borderRadius: radius.md }]}>
              <Glyph name="bulb" color={colors.success} size={16} />
              <Text style={[type.small, styles.infoText, { color: colors.successSolid }]}>
                All conversations are free &amp; confidential. No obligation to book any service.
              </Text>
            </View>
          </>
        ) : null}

        {step === 'call' ? (
          <>
            <View style={styles.callHero}>
              <View style={[styles.callAvatar, { backgroundColor: colors.primary }]}>
                <Glyph name="call" color={colors.textOnPrimary} size={34} />
              </View>
              <Text style={[type.section, { color: colors.text }]}>Call Gravity Hub Expert</Text>
              <Text style={[type.small, { color: colors.textTertiary }]}>Mon–Sat, 8 AM – 10 PM · average pickup 2 min</Text>
            </View>

            <View style={[styles.lineCard, { backgroundColor: colors.successSurface, borderColor: colors.success, borderRadius: radius.md }]}>
              <View style={styles.lineRow}>
                <Text style={[type.small, { color: colors.successSolid }]}>Support Line</Text>
                <Text style={[type.label, styles.lineValue, { color: colors.text }]}>{CALL_NUMBER}</Text>
              </View>
              <View style={styles.lineRow}>
                <Text style={[type.small, { color: colors.successSolid }]}>Language</Text>
                <Text style={[type.small, styles.lineValue, { color: colors.text }]}>Hindi · English</Text>
              </View>
            </View>

            <View style={styles.duoRow}>
              <Button title="Call Now" onPress={callNow} variant="success" style={styles.duoBtn} />
              <Button title="WhatsApp" onPress={openWhatsApp} variant="accent" style={styles.duoBtn} />
            </View>

            <Text style={[type.section, { color: colors.text }]}>What do you need help with?</Text>
            <View style={styles.chipWrap}>
              {CALL_TOPICS.map((topic) => (
                <TopicChip
                  key={topic}
                  label={topic}
                  active={callTopic === topic}
                  onPress={() => {
                    setCallTopic(callTopic === topic ? '' : topic);
                    setError('');
                  }}
                  colors={colors}
                  radius={radius}
                />
              ))}
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft, borderRadius: radius.md }]}>
              <Glyph name="bulb" color={colors.primary} size={16} />
              <Text style={[type.small, styles.infoText, { color: colors.primary }]}>
                Pick a topic first so we connect you to the right specialist — saves time on the call.
              </Text>
            </View>

            <Button title="Prefer a callback? Schedule one" onPress={openCallback} variant="outline" />
            <Button title="Back" onPress={() => setStep('menu')} variant="ghost" />
          </>
        ) : null}

        {step === 'callback' ? (
          <>
            <View style={[styles.infoCard, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft, borderRadius: radius.md }]}>
              <Glyph name="calendar" color={colors.primary} size={18} />
              <Text style={[type.small, styles.infoText, { color: colors.primary }]}>
                Pick a time that works — our expert will call you within 5 minutes of your chosen slot.
              </Text>
            </View>

            <Text style={[type.section, { color: colors.text }]}>Topic</Text>
            <View style={styles.chipWrap}>
              {CALLBACK_TOPICS.map((topic) => (
                <TopicChip
                  key={topic}
                  label={topic}
                  active={callbackTopic === topic}
                  onPress={() => {
                    setCallbackTopic(callbackTopic === topic ? '' : topic);
                    setError('');
                  }}
                  colors={colors}
                  radius={radius}
                />
              ))}
            </View>

            <Text style={[type.section, styles.sectionGap, { color: colors.text }]}>Preferred time</Text>
            <View style={styles.duoRow}>
              <View style={styles.duoField}>
                <DatePickerField
                  label="Date"
                  value={callbackDate}
                  onChange={(value) => {
                    setCallbackDate(value);
                    setError('');
                  }}
                />
              </View>
              <View style={styles.duoField}>
                <TextField
                  label="Time"
                  value={callbackTime}
                  onChangeText={(value) => {
                    setCallbackTime(value);
                    setError('');
                  }}
                  placeholder="HH:MM (24h)"
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  error={callbackTime && !validTime(callbackTime) ? 'Use 24-hour time, e.g. 14:30.' : ''}
                />
              </View>
            </View>

            <TextField
              label="Any specific detail? (optional)"
              value={callbackNote}
              onChangeText={(value) => {
                setCallbackNote(value);
                setError('');
              }}
              multiline
              maxLength={500}
              placeholder="Error code, brand, model, or what you're trying to figure out..."
            />

            <TextField
              label="Phone number"
              value={callbackPhone}
              onChangeText={(value) => {
                setCallbackPhone(value);
                setError('');
              }}
              keyboardType="phone-pad"
              maxLength={15}
            />

            <Button
              title="Request Callback ›"
              onPress={submitCallback}
              loading={sending}
              loadingLabel="Scheduling..."
              disabled={sending}
            />
            <Button title="Back" onPress={() => setStep('menu')} variant="ghost" />
          </>
        ) : null}

        {step === 'submitted' ? (
          <>
            <View style={styles.callHero}>
              <View style={[styles.callAvatar, { backgroundColor: colors.success }]}>
                <Glyph name="check" color={colors.onAccent} size={38} />
              </View>
              <Text style={[type.heading, { color: colors.text }]}>Callback Scheduled!</Text>
              <Text style={[type.small, { color: colors.textTertiary }]}>Our expert will call you at your chosen time</Text>
            </View>

            <View style={[styles.lineCard, { backgroundColor: colors.successSurface, borderColor: colors.success, borderRadius: radius.md }]}>
              <View style={styles.lineRow}>
                <Text style={[type.small, { color: colors.successSolid }]}>Request ID</Text>
                <Text style={[type.label, styles.lineValue, { color: colors.text }]}>{reference}</Text>
              </View>
              <View style={styles.lineRow}>
                <Text style={[type.small, { color: colors.successSolid }]}>Slot</Text>
                <Text style={[type.small, styles.lineValue, { color: colors.text }]}>{callbackDate} at {callbackTime}</Text>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft, borderRadius: radius.md }]}>
              <Glyph name="bulb" color={colors.primary} size={16} />
              <Text style={[type.small, styles.infoText, { color: colors.primary }]}>
                Need help before your callback? Chat on WhatsApp or use Gravity Hub AI for instant answers.
              </Text>
            </View>

            <View style={styles.duoRow}>
              <Button title="WhatsApp" onPress={openWhatsApp} variant="accent" style={styles.duoBtn} />
              <Button title="Ask AI" onPress={() => navigation.navigate('HelpSupport')} variant="primary" style={styles.duoBtn} />
            </View>

            <Button title="Back to Dashboard" onPress={() => navigation.navigate('Dashboard')} />
          </>
        ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionGap: {
    marginTop: 8,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  connectCopy: {
    flex: 1,
    gap: 2,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    flexGrow: 1,
    flexBasis: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    padding: 10,
  },
  topicCardText: {
    flex: 1,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    padding: 11,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    lineHeight: 19,
  },
  callHero: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
  },
  callAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lineCard: {
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lineValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  duoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  duoBtn: {
    flex: 1,
  },
  duoField: {
    flex: 1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
