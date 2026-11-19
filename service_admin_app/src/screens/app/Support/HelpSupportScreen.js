import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from '../../../components/Banner';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { Modal } from '../../../components/ui/Modal';
import { SearchBar } from '../../../components/ui/SearchBar';
import { supportApi } from '../../../api/resources';
import {
  faqItemsFrom,
  filterFaqs,
  matchFaq,
} from '../../../constants/supportFaq';
import { useCatalog } from '../../../flows/useCatalog';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { dialPhone, supportPhoneFromEnv } from '../../../constants/supportContact';

const CALL_NUMBER = supportPhoneFromEnv();

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function HelpSupportScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, type, radius, space } = useTheme();
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const hasChatted = messages.some((m) => m.from === 'user');
  const [draft, setDraft] = useState('');
  const [faqQuery, setFaqQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [messageModal, setMessageModal] = useState(false);
  const [callbackModal, setCallbackModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [callbackPhone, setCallbackPhone] = useState(user?.phone || '');
  const [callbackNote, setCallbackNote] = useState('');
  const [sending, setSending] = useState(false);

  const faqCatalog = useCatalog('faq');
  const faqItems = useMemo(() => faqItemsFrom(faqCatalog.groups.faq), [faqCatalog.groups]);
  const faqs = filterFaqs(faqItems, { query: faqQuery, category: 'all' });

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const appendUserMessage = useCallback((question) => {
    const id = nextId('user');
    setMessages((current) => [...current, { id, from: 'user', text: question }]);
    scrollToEnd();
    return id;
  }, [scrollToEnd]);

  const appendBotMessage = useCallback((answer, meta = {}) => {
    setMessages((current) => [
      ...current,
      {
        id: nextId('bot'),
        from: 'bot',
        text: answer,
        suggestHuman: Boolean(meta.suggestHuman),
        source: meta.source || 'faq',
      },
    ]);
    scrollToEnd();
  }, [scrollToEnd]);

  const appendExchange = useCallback((question, answer, meta = {}) => {
    appendUserMessage(question);
    appendBotMessage(answer, meta);
  }, [appendUserMessage, appendBotMessage]);

  const resolveAnswer = useCallback(async (text) => {
    // User bubble turant dikhao taaki chat blank na lage
    appendUserMessage(text);
    const local = matchFaq(faqItems, text);
    if (local) {
      appendBotMessage(local.answer, { source: 'faq', suggestHuman: false });
      return;
    }

    setAiLoading(true);
    setError('');
    try {
      const history = messages
        .filter((m) => m.from === 'user' || m.from === 'bot')
        .slice(-8)
        .map((m) => ({
          role: m.from === 'user' ? 'user' : 'assistant',
          text: m.text,
        }));

      const result = await supportApi.assist({ message: text, history });

      if (result.source === 'faq' || result.source === 'ai') {
        appendBotMessage(result.answer, {
          source: result.source,
          suggestHuman: result.suggestHuman,
        });
        return;
      }

      if (result.source === 'unavailable') {
        appendBotMessage(result.error || 'Assistant unavailable.', {
          source: 'unavailable',
          suggestHuman: true,
        });
        return;
      }

      appendBotMessage(
        result.message
          || 'I could not find a quick answer. Message support with details or request a callback.',
        { source: 'none', suggestHuman: true },
      );
    } catch (err) {
      appendBotMessage(
        `Something went wrong: ${getErrorMessage(err)}. You can retry or contact support directly.`,
        { source: 'error', suggestHuman: true },
      );
    } finally {
      setAiLoading(false);
    }
  }, [appendBotMessage, appendUserMessage, faqItems, messages]);

  function onFaqPress(item) {
    appendExchange(item.question, item.answer, { source: 'faq', suggestHuman: false });
  }

  function submitMessage() {
    const text = draft.trim();
    if (!text || aiLoading) return;
    setDraft('');
    resolveAnswer(text);
  }

  async function submitSupportRequest() {
    setError('');
    setSuccess('');
    setSending(true);
    try {
      const result = await supportApi.create({
        subject: subject.trim(),
        message: description.trim(),
      });
      setSuccess(`Message sent. Reference: ${result.request.id}`);
      setSubject('');
      setDescription('');
      setMessageModal(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function submitCallbackRequest() {
    const phone = callbackPhone.trim();
    if (phone.length < 8) {
      setError('Enter a valid phone number for the callback.');
      return;
    }
    setError('');
    setSuccess('');
    setSending(true);
    try {
      const body = [
        `Callback requested for ${phone}.`,
        callbackNote.trim() ? `Notes: ${callbackNote.trim()}` : null,
        draft.trim() ? `Related question: ${draft.trim()}` : null,
      ].filter(Boolean).join('\n');

      const result = await supportApi.create({
        subject: 'Callback request',
        message: body,
      });
      setSuccess(`Callback request saved. Reference: ${result.request.id}`);
      setCallbackNote('');
      setCallbackModal(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function callSupport() {
    try {
      await dialPhone(CALL_NUMBER);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function openMessageSupport(prefill = '') {
    setSubject(prefill ? `Help: ${prefill.slice(0, 80)}` : '');
    setDescription(prefill || '');
    setMessageModal(true);
  }

  const header = (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: space.sm }]}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={[styles.backBtn, { backgroundColor: colors.surfaceMuted, borderRadius: radius.button }]}
        >
          <Glyph name="back" color={colors.text} size={20} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
            Help & Support
          </Text>
          <Text style={[type.small, { color: colors.textTertiary }]}>
            FAQs · smart answers · human help when needed
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.button }]}>
          <Glyph name="spark" color={colors.primary} size={18} />
        </View>
      </View>
    </View>
  );

  const footer = (
    <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.footerActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => openMessageSupport(draft)}
          style={[styles.footerChip, { backgroundColor: colors.primaryLight, borderRadius: radius.pill }]}
        >
          <Glyph name="cover" color={colors.primary} size={14} />
          <Text style={[type.small, styles.strongText, { color: colors.accentText }]}>Message support</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => (CALL_NUMBER ? callSupport() : setCallbackModal(true))}
          style={[styles.footerChip, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill }]}
        >
          <Glyph name="user" color={colors.primary} size={14} />
          <Text style={[type.small, styles.strongText, { color: colors.accentText }]}>
            {CALL_NUMBER ? 'Call support' : 'Request a call'}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.composeRow, { borderColor: colors.border, borderRadius: radius.input, backgroundColor: colors.background }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask anything..."
          placeholderTextColor={colors.placeholder}
          editable={!aiLoading}
          multiline
          maxLength={500}
          onSubmitEditing={submitMessage}
          returnKeyType="send"
          style={[styles.composeInput, type.body, { color: colors.text }]}
          accessibilityLabel="Ask a support question"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send question"
          onPress={submitMessage}
          disabled={!draft.trim() || aiLoading}
          style={[
            styles.sendButton,
            {
              backgroundColor: draft.trim() && !aiLoading ? colors.primary : colors.border,
              borderRadius: radius.button,
            },
          ]}
        >
          {aiLoading ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Glyph name="chevron" color={colors.textOnPrimary} size={18} />
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <Screen
        scroll={false}
        header={header}
        headerColor={colors.background}
        statusBarStyle="dark-content"
        footer={footer}
        footerFlush
        contentGap={space.sm}
      >
        <Banner message={error} tone="error" />
        <Banner message={success} tone="success" />

        {!hasChatted ? (
        <>
        <SearchBar
          value={faqQuery}
          onChangeText={setFaqQuery}
          placeholder="Search FAQs — billing, OTP, jobs..."
          accessibilityLabel="Search help topics"
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.faqScroll}
        >
        <View style={styles.faqBlock}>
          {faqCatalog.loading && !faqItems.length ? (
            <ActivityIndicator color={colors.primary} />
          ) : faqCatalog.error && !faqItems.length ? (
            <Text style={type.muted}>{`Could not load FAQs: ${faqCatalog.error}`}</Text>
          ) : faqs.length === 0 ? (
            <Text style={type.muted}>No FAQ matches that search. Try another keyword or ask below.</Text>
          ) : (
            faqs.slice(0, 20).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => onFaqPress(item)}
                style={[styles.faqRow, { backgroundColor: colors.cardSoft, borderRadius: radius.md }]}
              >
                <Glyph name="book" color={colors.primary} size={16} />
                <Text style={[type.label, styles.faqQuestion]} numberOfLines={2}>{item.question}</Text>
                <Glyph name="chevron" color={colors.textTertiary} size={14} />
              </Pressable>
            ))
          )}
        </View>
        </ScrollView>
        </>
        ) : (
        <View style={styles.chatBlockFull}>
          {aiLoading ? <Text style={[type.small, { color: colors.textTertiary }]}>Finding an answer…</Text> : null}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesFull}
            contentContainerStyle={styles.messageListFull}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToEnd}
          >
            {messages.map((item) => (
              <View key={item.id} style={styles.messageWrap}>
                <View
                  style={[
                    styles.message,
                    item.from === 'user' ? styles.userMessage : styles.botMessage,
                    {
                      backgroundColor: item.from === 'user'
                        ? colors.primary
                        : colors.cardSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      type.body,
                      { color: item.from === 'user' ? colors.textOnPrimary : colors.text },
                    ]}
                  >
                    {item.text}
                  </Text>
                  {item.from === 'bot' && item.source ? (
                    <Text style={[type.small, styles.sourceTag, { color: colors.textTertiary }]}>
                      {item.source === 'ai' ? 'AI assistant' : item.source === 'faq' ? 'FAQ' : item.source === 'unavailable' ? 'Assistant unavailable' : 'Help bot'}
                    </Text>
                  ) : null}
                </View>
                {item.from === 'bot' && item.suggestHuman ? (
                  <View style={styles.escalationRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openMessageSupport(item.text)}
                      style={[styles.escalationBtn, { borderColor: colors.primary, borderRadius: radius.pill }]}
                    >
                      <Text style={[type.small, styles.strongText, { color: colors.primary }]}>Message support</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCallbackModal(true)}
                      style={[styles.escalationBtn, { borderColor: colors.borderStrong, borderRadius: radius.pill }]}
                    >
                      <Text style={[type.small, styles.strongText, { color: colors.textSecondary }]}>Request a call</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
        )}
      </Screen>

      <Modal
        visible={messageModal}
        title="Message support"
        description="We will respond on your registered contact. Include steps you already tried."
        onClose={() => setMessageModal(false)}
        primaryAction={{
          label: 'Send message',
          onPress: submitSupportRequest,
          loading: sending,
        }}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => setMessageModal(false),
        }}
      >
        <View style={styles.modalFields}>
          <TextField label="Subject" value={subject} onChangeText={setSubject} maxLength={160} />
          <TextField
            label="Describe your issue"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={4000}
          />
          <Text style={type.small}>
            Signed in as {user && (user.email || user.phone) ? user.email || user.phone : 'your account'}.
          </Text>
        </View>
      </Modal>

      <Modal
        visible={callbackModal}
        title="Request a callback"
        description={CALL_NUMBER
          ? 'Prefer we call you? Save a callback request — you can still dial support directly if urgent.'
          : 'Phone support is not configured in this build. Submit a callback request and our team will reach out.'}
        onClose={() => setCallbackModal(false)}
        primaryAction={{
          label: 'Submit callback request',
          onPress: submitCallbackRequest,
          loading: sending,
        }}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => setCallbackModal(false),
        }}
      >
        <View style={styles.modalFields}>
          <TextField
            label="Phone number"
            value={callbackPhone}
            onChangeText={setCallbackPhone}
            keyboardType="phone-pad"
            maxLength={20}
          />
          <TextField
            label="Best time / notes (optional)"
            value={callbackNote}
            onChangeText={setCallbackNote}
            multiline
            maxLength={500}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  faqBlock: {
    gap: 8,
  },
  faqScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  faqQuestion: {
    flex: 1,
  },
  chatBlockFull: {
    flex: 1,
    flexGrow: 1,
    gap: 8,
    minHeight: 200,
  },
  messagesFull: {
    flex: 1,
    flexGrow: 1,
  },
  messageListFull: {
    gap: 10,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageWrap: {
    gap: 6,
  },
  message: {
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  botMessage: {
    alignSelf: 'flex-start',
  },
  sourceTag: {
    marginTop: 6,
  },
  escalationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 4,
  },
  escalationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  strongText: {
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  footerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  composeInput: {
    flex: 1,
    maxHeight: 96,
    paddingVertical: 6,
    includeFontPadding: false,
  },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFields: {
    gap: 12,
    marginTop: 8,
  },
});
