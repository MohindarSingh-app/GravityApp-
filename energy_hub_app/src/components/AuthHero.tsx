import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { registerThemeStyles, theme } from './theme';

interface AuthHeroProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
}

export const AuthHero: React.FC<AuthHeroProps> = ({
  eyebrow = 'ENERGY HUB',
  title,
  subtitle,
}) => {
  useUserPreferences();

  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
  <View style={[styles.container, compact && styles.containerCompact]}>
    <View style={styles.glowTop} />
    <View style={styles.glowBottom} />
    <View style={styles.brandRow}>
      <View style={styles.brandMark}>
        <Text style={styles.brandLetter}>E</Text>
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
    </View>
    <View style={styles.content}>
      <View style={styles.copy}>
        <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {!compact && <View style={styles.workOrder}>
        <View style={styles.orderTop}>
          <View style={styles.orderIcon}>
            <Text style={styles.orderIconText}>EH</Text>
          </View>
          <View style={styles.orderHeading}>
            <View style={styles.lineLong} />
            <View style={styles.lineShort} />
          </View>
          <View style={styles.statusDot} />
        </View>
        <View style={styles.orderBottom}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.progressText}>FIELD READY</Text>
        </View>
      </View>}
    </View>
  </View>
  );
};

const build_styles = () => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.primaryDark,
    minHeight: 218,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 26,
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  containerCompact: { minHeight: 190, paddingHorizontal: 20, paddingBottom: 22 },
  glowTop: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -70, top: -100, backgroundColor: 'rgba(21,94,239,0.35)' },
  glowBottom: { position: 'absolute', width: 120, height: 120, borderRadius: 60, left: -50, bottom: -70, backgroundColor: 'rgba(0,168,199,0.18)' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { height: 34, width: 34, borderRadius: 11, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: theme.colors.primaryDark, fontSize: 16, fontWeight: '800' },
  eyebrow: { color: theme.colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 20 },
  copy: { flex: 1.15 },
  title: { color: theme.colors.white, fontSize: 27, lineHeight: 33, fontWeight: '800', letterSpacing: -0.5 },
  titleCompact: { fontSize: 24, lineHeight: 29 },
  subtitle: { color: '#D7E4F5', fontSize: 13, lineHeight: 19, marginTop: 7 },
  workOrder: { flex: 0.8, minHeight: 112, maxWidth: 145, backgroundColor: theme.colors.white, borderRadius: 18, padding: 12, justifyContent: 'space-between', transform: [{ rotate: '2deg' }], ...theme.elevation.medium },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  orderIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  orderIconText: { color: theme.colors.white, fontSize: 9, fontWeight: '800' },
  orderHeading: { flex: 1, gap: 5 },
  lineLong: { height: 5, borderRadius: 3, backgroundColor: theme.colors.primaryDark, width: '90%' },
  lineShort: { height: 4, borderRadius: 3, backgroundColor: theme.colors.borderStrong, width: '62%' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success },
  orderBottom: { gap: 7 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: theme.colors.accentLight, overflow: 'hidden' },
  progressFill: { width: '72%', height: '100%', backgroundColor: theme.colors.accent },
  progressText: { color: theme.colors.primaryDark, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
