import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Glyph } from '../Glyph';

export function OfflineBanner({ onRetry, message }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Offline mode — retry connection"
      onPress={onRetry}
      style={styles.banner}
    >
      <View style={styles.row}>
        <Glyph name="alert" color={colorsDangerText()} size={16} />
        <Text style={styles.text}>{message || 'Backend connect nahi ho raha — offline/demo mode chal raha hai.'}</Text>
      </View>
      {onRetry && (
        <Text style={styles.retry}>Retry</Text>
      )}
    </Pressable>
  );
}

function colorsDangerText() {
  return '#ef4444';
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  text: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  retry: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
});
