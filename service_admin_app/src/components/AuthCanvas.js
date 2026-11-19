import { useRef } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { BrandMark } from './BrandMark';
import { Glyph } from './Glyph';
import { FormNavigationProvider } from './forms/FormNavigation';

const HERO = require('../assets/hero-plant.jpg');

export function AuthCanvas({
  headline,
  kicker,
  detail,
  children,
  variant = 'sheet',
  footer = null,
  onBack,
}) {
  const insets = useSafeAreaInsets();
  const formScrollRef = useRef(null);
  const formScrollOffsetRef = useRef(0);
  const { colors, radius, scheme } = useTheme();
  const welcome = variant === 'welcome';

  return (
    <View style={[styles.root, { backgroundColor: welcome ? colors.background : colors.deepSurface }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={welcome ? colors.deepSurface : colors.deepSurface}
        translucent={false}
      />
      {welcome ? (
        <ImageBackground
          source={HERO}
          resizeMode="cover"
          imageStyle={[
            styles.welcomeBackgroundImage,
            { opacity: 0.58 },
          ]}
          style={[styles.welcomeBackground, { backgroundColor: colors.deepSurface }]}
        >
          <View
            style={[
              styles.welcomeContent,
              {
                paddingTop: insets.top + 12,
                paddingBottom: 18,
              },
            ]}
          >
            <View style={styles.welcomeTop}>
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={onBack}
                  style={[styles.back, { backgroundColor: colors.surface }]}
                >
                  <Glyph name="back" color={colors.text} size={22} />
                </Pressable>
              ) : null}
              <BrandMark />
            </View>
            <View style={styles.welcomeMain}>
              <View style={styles.welcomeCopy}>
                {kicker ? <Text style={[styles.kicker, styles.welcomeKicker, { color: colors.primary }]}>{kicker}</Text> : null}
                {headline ? (
                  <Text style={[styles.headline, styles.welcomeHeadline, { color: colors.text }]} accessibilityRole="header">
                    {headline}
                  </Text>
                ) : null}
                {detail ? <Text style={[styles.detail, styles.welcomeDetail, { color: colors.textSecondary }]}>{detail}</Text> : null}
              </View>
            </View>
          </View>
          <View
            style={[
              styles.welcomeSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
              },
            ]}
          >
            <FormNavigationProvider bottomOffset={Math.max(insets.bottom, 16) + 16}>
              {children}
            </FormNavigationProvider>
          </View>
        </ImageBackground>
      ) : (
        <>
          <ImageBackground source={HERO} style={styles.hero} imageStyle={styles.heroImage}>
            <View style={styles.veil} />
            <View style={[styles.heroInner, { paddingTop: insets.top + 12 }]}>
              <View style={styles.brandRow}>
                {onBack ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    onPress={onBack}
                    style={styles.back}
                  >
                    <Glyph name="back" color={colors.text} size={22} />
                  </Pressable>
                ) : null}
                <BrandMark />
              </View>
              <View style={styles.heroCopy}>
                {kicker ? <Text style={[styles.kicker, { color: colors.primary }]}>{kicker}</Text> : null}
                {headline ? (
                  <Text style={[styles.headline, { color: colors.text }]} accessibilityRole="header">
                    {headline}
                  </Text>
                ) : null}
                {detail ? <Text style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text> : null}
              </View>
            </View>
          </ImageBackground>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radius.sheet,
                  borderTopRightRadius: radius.sheet,
                  paddingBottom: footer ? 8 : Math.max(insets.bottom, 16) + 8,
                },
              ]}
            >
              <FormNavigationProvider
                scrollRef={formScrollRef}
                scrollOffsetRef={formScrollOffsetRef}
                bottomOffset={Math.max(insets.bottom, 16) + (footer ? 72 : 16)}
              >
                <ScrollView
                  ref={formScrollRef}
                  onScroll={(event) => {
                    formScrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
                  }}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  bounces={false}
                  contentContainerStyle={styles.sheetBody}
                >
                  {children}
                </ScrollView>
                {footer ? (
                  <View style={{ paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) }}>
                    {footer}
                  </View>
                ) : null}
              </FormNavigationProvider>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

export function AuthSwitch({ lead, action, onPress }) {
  const { colors, type } = useTheme();
  return (
    <Text style={[type.body, styles.switchLine, { color: colors.textSecondary }]}>
      {lead}{' '}
      <Text
        accessibilityRole="link"
        onPress={onPress}
        style={[styles.switchAction, { color: colors.accentText }]}
      >
        {action}
      </Text>
    </Text>
  );
}

export function AuthSocial({ onApple, onGoogle, disabled = false }) {
  const { colors, radius, type } = useTheme();
  return (
    <View style={styles.social}>
      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: colors.border }]} />
        <Text style={[type.small, { color: colors.textTertiary }]}>Or continue with</Text>
        <View style={[styles.orLine, { backgroundColor: colors.border }]} />
      </View>
      <View style={styles.socialRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          disabled={disabled}
          onPress={onApple}
          style={[styles.brandButton, { backgroundColor: colors.primary, borderRadius: radius.button, opacity: disabled ? 0.45 : 1 }]}
        >
          <Text style={[styles.mark, { color: colors.onAccent }]}>A</Text>
          <Text style={[type.button, { color: colors.onAccent }]}>Apple</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={disabled}
          onPress={onGoogle}
          style={[
            styles.lightButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              borderRadius: radius.button,
              opacity: disabled ? 0.45 : 1,
            },
          ]}
        >
          <Text style={[styles.mark, { color: colors.text }]}>G</Text>
          <Text style={[type.button, { color: colors.text }]}>Google</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function FieldIcon({ name }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldIcon}>
      <Glyph name={name} color={colors.textTertiary} size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  hero: {
    minHeight: 250,
  },
  welcomeContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  welcomeBackground: {
    flex: 1,
  },
  welcomeBackgroundImage: {
    resizeMode: 'cover',
  },
  welcomeTop: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  welcomeMain: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 64,
  },
  welcomeCopy: {
    gap: 12,
    paddingBottom: 8,
  },
  welcomeKicker: {
    letterSpacing: 1.8,
    opacity: 1,
  },
  welcomeHeadline: {
    fontSize: 42,
    lineHeight: 47,
    maxWidth: 280,
    marginTop: 0,
  },
  welcomeDetail: {
    maxWidth: 360,
    opacity: 1,
  },
  welcomeSheet: {
    gap: 12,
    borderTopWidth: 1,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 24,
    paddingHorizontal: 24,
    minHeight: 190,
    justifyContent: 'center',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    minHeight: 260,
    justifyContent: 'space-between',
  },
  headline: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    maxWidth: 300,
    marginTop: 24,
  },
  heroCopy: {
    gap: 12,
    paddingBottom: 8,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '700',
    opacity: 0.86,
  },
  headlinePhoto: {
    fontSize: 34,
    lineHeight: 40,
    maxWidth: 320,
  },
  detail: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    maxWidth: 320,
    opacity: 0.92,
  },
  sheet: {
    flex: 1,
    marginTop: -28,
  },
  sheetBody: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 16,
  },
  switchLine: {
    textAlign: 'center',
  },
  switchAction: {
    fontWeight: '700',
  },
  social: {
    gap: 12,
    marginTop: 4,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  brandButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lightButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  mark: {
    fontSize: 16,
    fontWeight: '700',
  },
  fieldIcon: {
    marginRight: 8,
  },
});
