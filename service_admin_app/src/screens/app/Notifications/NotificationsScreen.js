import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { notificationApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function NotificationsScreen() {
  const navigation = useNavigation();
  const { colors, type } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await notificationApi.list();
      setNotifications(result.notifications || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function openNotification(item) {
    setSelected(item);
    if (item.isRead) return;
    setOpening(true);
    setError('');
    try {
      await notificationApi.markRead(item.id);
      setNotifications((current) => current.map((entry) => (
        entry.id === item.id ? { ...entry, isRead: true } : entry
      )));
      setSelected((current) => current && current.id === item.id
        ? { ...current, isRead: true }
        : current);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setOpening(false);
    }
  }

  return (
    <Screen header={<AppBar title="Notifications" onBack={() => navigation.goBack()} />}>
      <Text style={type.display} accessibilityRole="header">Notifications</Text>
      <Text style={type.muted}>Unread updates are highlighted. Open one to view its details.</Text>
      <Banner message={error} />
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && !error && !notifications.length ? (
        <EmptyState title="You’re all caught up" message="New account and company updates will appear here." />
      ) : null}
      {notifications.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.isRead ? 'Read' : 'Unread'} notification: ${item.title}`}
          onPress={() => openNotification(item)}
          style={({ pressed }) => [
            styles.item,
            {
              backgroundColor: item.isRead ? colors.surface : colors.primaryLight,
              borderColor: item.isRead ? colors.border : colors.primary,
              transform: [{ scale: item.isRead ? 0.985 : 1 }],
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.icon, { backgroundColor: item.isRead ? colors.surfaceSecondary : colors.surface }]}>
            <Glyph name={item.isRead ? 'check' : 'bell'} color={item.isRead ? colors.textTertiary : colors.primary} size={18} />
          </View>
          <View style={styles.copy}>
            <Text style={[type.heading, styles.title]} numberOfLines={2}>{item.title}</Text>
            <Text style={type.small} numberOfLines={2}>{item.message}</Text>
            <Text style={[type.small, { color: colors.textTertiary }]}>{formatDate(item.createdAt)}</Text>
          </View>
          {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
        </Pressable>
      ))}
      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <Card style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[type.heading, styles.modalTitle]}>{selected && selected.title}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close notification" onPress={() => setSelected(null)}>
                <Glyph name="close" color={colors.textSecondary} size={22} />
              </Pressable>
            </View>
            <Text style={type.body}>{selected && selected.message}</Text>
            <Banner message={error} />
            {selected && selected.entityType ? (
              <Text style={type.small}>Related to: {selected.entityType}</Text>
            ) : null}
            <Text style={[type.small, { color: colors.textTertiary }]}>
              {selected ? formatDate(selected.createdAt) : ''}
            </Text>
            {opening ? <ActivityIndicator color={colors.primary} /> : null}
            <Button title="Close" variant="ghost" onPress={() => setSelected(null)} />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  icon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.9,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
  },
});
