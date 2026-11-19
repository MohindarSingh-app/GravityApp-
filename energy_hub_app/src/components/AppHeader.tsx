import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NavGlyph } from './NavGlyph';
import { registerThemeStyles, theme } from './theme';
import { useUserPreferences } from '../providers/UserPreferencesProvider';

interface ProfileAvatarButtonProps {
  uri?: string | null;
  initial?: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  iconColor?: string;
  backgroundColor?: string;
  initialColor?: string;
}

export const ProfileAvatarButton: React.FC<ProfileAvatarButtonProps> = ({
  uri,
  initial,
  onPress,
  accessibilityLabel,
  size = 36,
  iconColor = theme.colors.primary,
  backgroundColor = theme.colors.primaryLight,
  initialColor = theme.colors.primaryDark,
}) => {
  const ringWidth = 2;
  const ring = size + ringWidth * 2;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      activeOpacity={theme.interaction.pressedOpacity}
      style={[styles.avatarHit, { width: ring, height: ring, borderRadius: ring / 2 }]}
    >
      <View style={[styles.avatarRing, { borderRadius: ring / 2 }]}>
        <View style={[styles.googleQuad, styles.googleRed]} />
        <View style={[styles.googleQuad, styles.googleBlue]} />
        <View style={[styles.googleQuad, styles.googleYellow]} />
        <View style={[styles.googleQuad, styles.googleGreen]} />
        <View style={[styles.avatarCore, {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        }]}
        >
          {uri ? (
            <Image source={{ uri }} style={styles.avatarImage} />
          ) : initial ? (
            <Text style={[styles.avatarInitial, { color: initialColor, fontSize: Math.round(size * 0.42) }]}>{initial}</Text>
          ) : (
            <NavGlyph name="profile" color={iconColor} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

type BackNavigation = {
  canGoBack: () => boolean;
  goBack: () => void;
  navigate: (screen: 'Home') => void;
};

export const goBackOrHome = (navigation: BackNavigation) => {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.navigate('Home');
  }
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onBack,
}) => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { avatarUri, colors } = useUserPreferences();
  const showProfile = !['PartnerProfile', 'PersonalInfo', 'Status', 'AdminSchedule'].includes(route.name);

  return (
    <View style={[styles.container, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.titleRow}>
        {onBack ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.backButton, { backgroundColor: colors.primaryLight }]}
            onPress={onBack}
            activeOpacity={theme.interaction.pressedOpacity}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {showProfile ? (
          <ProfileAvatarButton
            uri={avatarUri}
            onPress={() => navigation.navigate('PartnerProfile')}
            accessibilityLabel="Open profile"
            iconColor={colors.primary}
            backgroundColor={colors.primaryLight}
          />
        ) : null}
      </View>
      {subtitle ? (
        <Text
          style={[styles.subtitle, { color: colors.secondaryText, marginLeft: onBack ? 48 : 0 }]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const build_styles = () => StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 44,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.pill,
  },
  title: {
    flex: 1,
    fontSize: theme.typography.titleLarge.fontSize,
    lineHeight: theme.typography.titleLarge.lineHeight,
    fontWeight: theme.typography.titleLarge.fontWeight,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: theme.typography.captionLarge.fontSize,
    lineHeight: theme.typography.captionLarge.lineHeight,
    marginTop: 2,
  },
  avatarHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleQuad: {
    position: 'absolute',
    width: '50%',
    height: '50%',
  },
  googleRed: { top: 0, left: 0, backgroundColor: '#EA4335' },
  googleBlue: { top: 0, right: 0, backgroundColor: '#4285F4' },
  googleYellow: { bottom: 0, left: 0, backgroundColor: '#FBBC05' },
  googleGreen: { bottom: 0, right: 0, backgroundColor: '#34A853' },
  avatarCore: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.white,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { fontWeight: '800' },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
