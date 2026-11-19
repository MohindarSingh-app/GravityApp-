import React from 'react';
import { StyleSheet, View } from 'react-native';

export type NavGlyphName =
  | 'home'
  | 'jobs'
  | 'active'
  | 'earnings'
  | 'profile'
  | 'workshop'
  | 'incoming'
  | 'queue'
  | 'catalog'
  | 'schedule';

const shift = (hex: string, amount: number) => {
  const raw = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return hex;
  const channel = (start: number) => Math.max(0, Math.min(255, parseInt(raw.slice(start, start + 2), 16) + amount))
    .toString(16)
    .padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
};

const HomeGlyph = ({ color }: { color: string }) => (
  <View style={styles.box}>
    <View style={[styles.roof, { borderBottomColor: shift(color, 48) }]} />
    <View style={[styles.house, { backgroundColor: color, borderBottomColor: shift(color, -40) }]}>
      <View style={[styles.door, { backgroundColor: shift(color, -55) }]} />
    </View>
  </View>
);

const JobsGlyph = ({ color }: { color: string }) => (
  <View style={styles.box}>
    <View style={[styles.handle, { borderColor: color }]} />
    <View style={[styles.caseBody, { backgroundColor: color }]}>
      <View style={[styles.caseBand, { backgroundColor: shift(color, -40) }]} />
      <View style={[styles.caseClasp, { backgroundColor: shift(color, 70) }]} />
    </View>
  </View>
);

const ActiveGlyph = ({ color }: { color: string }) => (
  <View style={styles.box}>
    <View style={[styles.clip, { backgroundColor: shift(color, 40) }]} />
    <View style={[styles.board, { backgroundColor: color }]}>
      <View style={styles.boardLine} />
      <View style={[styles.boardLine, styles.boardLineShort]} />
      <View style={[styles.boardCheck, { borderColor: shift(color, 80) }]} />
    </View>
  </View>
);

const EarningsGlyph = ({ color }: { color: string }) => (
  <View style={styles.box}>
    <View style={[styles.wallet, { backgroundColor: color }]}>
      <View style={[styles.walletFlap, { backgroundColor: shift(color, 36) }]} />
      <View style={[styles.coin, { backgroundColor: '#FBBC05', borderColor: shift(color, -30) }]} />
    </View>
  </View>
);

const ProfileGlyph = ({ color }: { color: string }) => (
  <View style={styles.box}>
    <View style={[styles.head, { backgroundColor: shift(color, 36) }]} />
    <View style={[styles.shoulders, { backgroundColor: color }]} />
  </View>
);

const WorkshopGlyph = ({ color }: { color: string }) => (
  <View style={styles.box}>
    <View style={[styles.wrenchHead, { borderColor: color, backgroundColor: shift(color, 50) }]} />
    <View style={[styles.wrenchShaft, { backgroundColor: color }]} />
  </View>
);

const IncomingGlyph = ({ color }: { color: string }) => (
  <View style={styles.box}>
    <View style={[styles.boxTop, { backgroundColor: shift(color, 48) }]} />
    <View style={styles.boxRow}>
      <View style={[styles.boxFace, { backgroundColor: color }]} />
      <View style={[styles.boxSide, { backgroundColor: shift(color, -45) }]} />
    </View>
  </View>
);

const QueueGlyph = ({ color }: { color: string }) => (
  <View style={styles.queue}>
    {[0, 1, 2].map((row) => (
      <View key={row} style={styles.queueRow}>
        <View style={[styles.queueDot, { backgroundColor: shift(color, row === 0 ? 40 : -20) }]} />
        <View style={[styles.queueBar, { backgroundColor: color, width: row === 2 ? 10 : 14 }]} />
      </View>
    ))}
  </View>
);

const CatalogGlyph = ({ color }: { color: string }) => (
  <View style={styles.catalog}>
    {[shift(color, 40), color, shift(color, -20), shift(color, -45)].map((tile, index) => (
      <View key={tile + index} style={[styles.catalogTile, { backgroundColor: tile }]} />
    ))}
  </View>
);

const ScheduleGlyph = ({ color }: { color: string }) => (
  <View style={[styles.calendar, { backgroundColor: shift(color, 70), borderColor: color }]}>
    <View style={[styles.calendarHead, { backgroundColor: color }]} />
    <View style={styles.calendarDots}>
      <View style={[styles.calendarDot, { backgroundColor: color }]} />
      <View style={[styles.calendarDot, { backgroundColor: shift(color, -30) }]} />
    </View>
  </View>
);

const glyphs: Record<NavGlyphName, React.FC<{ color: string }>> = {
  home: HomeGlyph,
  jobs: JobsGlyph,
  active: ActiveGlyph,
  earnings: EarningsGlyph,
  profile: ProfileGlyph,
  workshop: WorkshopGlyph,
  incoming: IncomingGlyph,
  queue: QueueGlyph,
  catalog: CatalogGlyph,
  schedule: ScheduleGlyph,
};

export const NavGlyph: React.FC<{ name: NavGlyphName; color: string }> = ({ name, color }) => {
  const Glyph = glyphs[name];
  return <Glyph color={color} />;
};

const styles = StyleSheet.create({
  box: { width: 22, height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  house: {
    width: 15,
    height: 10,
    marginTop: -1,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderBottomWidth: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  door: { width: 4, height: 5, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  handle: {
    width: 8,
    height: 4,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  caseBody: {
    width: 18,
    height: 12,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  caseBand: { position: 'absolute', left: 0, right: 0, top: 5, height: 2 },
  caseClasp: { width: 4, height: 4, borderRadius: 1 },
  clip: { width: 8, height: 4, borderRadius: 2, marginBottom: -2, zIndex: 1 },
  board: {
    width: 15,
    height: 16,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 3,
  },
  boardLine: { width: 9, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.85)' },
  boardLineShort: { width: 6, alignSelf: 'flex-start', marginLeft: 3 },
  boardCheck: { position: 'absolute', right: 2, bottom: 2, width: 4, height: 2, borderLeftWidth: 1.5, borderBottomWidth: 1.5, transform: [{ rotate: '-45deg' }] },
  wallet: { width: 18, height: 13, borderRadius: 3, overflow: 'hidden', justifyContent: 'center' },
  walletFlap: { position: 'absolute', left: 0, right: 0, top: 0, height: 4 },
  coin: { position: 'absolute', right: 2, width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  head: { width: 8, height: 8, borderRadius: 4, marginBottom: 1 },
  shoulders: { width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  wrenchHead: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, marginBottom: -2 },
  wrenchShaft: { width: 4, height: 12, borderRadius: 2, transform: [{ rotate: '35deg' }], marginBottom: 1 },
  boxTop: { width: 16, height: 5, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  boxRow: { flexDirection: 'row' },
  boxFace: { width: 12, height: 10, borderBottomLeftRadius: 2 },
  boxSide: { width: 4, height: 10, borderBottomRightRadius: 2 },
  queue: { width: 22, height: 22, justifyContent: 'center', gap: 3 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  queueDot: { width: 4, height: 4, borderRadius: 1 },
  queueBar: { height: 3, borderRadius: 2 },
  catalog: { width: 18, height: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  catalogTile: { width: 8, height: 8, borderRadius: 2 },
  calendar: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, overflow: 'hidden', marginBottom: 2 },
  calendarHead: { height: 5 },
  calendarDots: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  calendarDot: { width: 3, height: 3, borderRadius: 1 },
});
