import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme/ThemeContext';
import { Glyph } from '../Glyph';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { googleMapsEmbedUrl } from '../../utils/liveMap';

export function LiveTrackCard({
  liveLabel = 'JOB LOCATION',
  etaLabel,
  distanceLabel,
  person,
  title,
  locationLabel,
  mapUrl,
  onOpenMap,
  mapCoords,
  mapLabel,
  steps = [],
  notice,
  onCall,
  onChat,
  onShare,
  onCancel,
  cancelLabel = 'Cancel Request',
}) {
  const { colors, radius, type } = useTheme();
  const [mapLoading, setMapLoading] = useState(true);
  const embedUrl = googleMapsEmbedUrl({ coords: mapCoords, label: mapLabel });

  return (
    <View style={styles.stack}>
      {embedUrl ? (
        <View style={[styles.map, { backgroundColor: colors.infoSurface, borderRadius: radius.card }]}>
          <WebView
            source={{ uri: embedUrl }}
            style={styles.webmap}
            onLoadStart={() => setMapLoading(true)}
            onLoadEnd={() => setMapLoading(false)}
          />
          {mapLoading ? (
            <View style={styles.mapLoader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null}
          <View style={[styles.livePill, { backgroundColor: colors.success, borderRadius: radius.pill }]} pointerEvents="none">
            <View style={[styles.livePulse, { backgroundColor: colors.surface }]} />
            <Text style={[type.small, styles.liveText, { color: colors.surface }]}>{liveLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open job location"
            onPress={onOpenMap}
            style={[styles.mapTag, styles.openMapTag, { backgroundColor: colors.primary, borderRadius: radius.sm }]}
          >
            <Text style={[type.small, { color: colors.textOnPrimary, fontWeight: '800' }]}>Open job location</Text>
          </Pressable>
          {etaLabel ? (
            <View style={[styles.mapTag, styles.etaTag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm }]} pointerEvents="none">
              <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>{etaLabel}</Text>
            </View>
          ) : null}
          {distanceLabel ? (
            <View style={[styles.mapTag, styles.distanceTag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm }]} pointerEvents="none">
              <Text style={[type.small, { color: colors.textSecondary }]} numberOfLines={1}>{distanceLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : (
      <View style={[styles.map, { backgroundColor: colors.infoSurface, borderRadius: radius.card }]}>
        <View style={[styles.livePill, { backgroundColor: colors.success, borderRadius: radius.pill }]}>
          <View style={[styles.livePulse, { backgroundColor: colors.surface }]} />
          <Text style={[type.small, styles.liveText, { color: colors.surface }]}>{liveLabel}</Text>
        </View>
        {etaLabel ? (
          <View style={[styles.mapTag, styles.etaTag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm }]}>
            <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>{etaLabel}</Text>
          </View>
        ) : null}
        {distanceLabel ? (
          <View style={[styles.mapTag, styles.distanceTag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm }]}>
            <Text style={[type.small, { color: colors.textSecondary }]} numberOfLines={1}>{distanceLabel}</Text>
          </View>
        ) : null}
        {(mapUrl || onOpenMap) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open job location"
            onPress={onOpenMap}
            style={[styles.mapTag, styles.openMapTag, { backgroundColor: colors.primary, borderRadius: radius.sm }]}
          >
            <Text style={[type.small, { color: colors.textOnPrimary, fontWeight: '800' }]}>Open job location</Text>
          </Pressable>
        ) : null}
      </View>
      )}

      {locationLabel ? (
        <View style={[styles.location, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
          <View style={[styles.locationIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.chip }]}>
            <Glyph name="pin" color={colors.primary} size={16} />
          </View>
          <View style={styles.locationCopy}>
            <Text style={[type.small, { color: colors.textTertiary }]}>Job location</Text>
            <Text style={[type.heading, { color: colors.text }]} numberOfLines={2}>{locationLabel}</Text>
          </View>
        </View>
      ) : null}

      {person ? (
        <View style={[styles.person, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight, borderRadius: radius.pill }]}>
            <Text style={[type.heading, { color: colors.primary }]}>{person.initials}</Text>
          </View>
          <View style={styles.personCopy}>
            <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>{person.name}</Text>
            <Text style={[type.small, { color: colors.textSecondary }]} numberOfLines={1}>{person.subtitle}</Text>
          </View>
          {onCall ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call"
              onPress={onCall}
              style={[styles.roundAction, { backgroundColor: colors.primary }]}
            >
              <Glyph name="call" color={colors.textOnPrimary} size={16} />
            </Pressable>
          ) : null}
          {onChat ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Message"
              onPress={onChat}
              style={[styles.roundAction, { backgroundColor: colors.success }]}
            >
              <Glyph name="chat" color={colors.surface} size={16} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {title ? <Text style={[type.label, { color: colors.text }]}>{title}</Text> : null}

      <View style={styles.timeline}>
        {steps.map((step, index) => {
          const active = step.state === 'active';
          const complete = step.state === 'complete';
          const color = complete ? colors.success : active ? colors.info : colors.borderStrong;
          return (
            <View key={step.title} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[
                  styles.timelineDot,
                  { backgroundColor: color, borderColor: active ? colors.infoSurface : colors.surface },
                ]}
                />
                {index < steps.length - 1 ? (
                  <View style={[styles.timelineLine, { backgroundColor: complete ? colors.success : colors.border }]} />
                ) : null}
              </View>
              <View style={[styles.timelineCopy, { opacity: step.state === 'pending' ? 0.45 : 1 }]}>
                <Text style={[type.heading, { color: active ? colors.info : colors.text }]}>{step.title}</Text>
                {step.detail ? <Text style={[type.small, { color: colors.textSecondary }]}>{step.detail}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>

      {notice ? (
        <Card>
          <Text style={[type.body, { color: colors.textSecondary }]}>{notice}</Text>
        </Card>
      ) : null}

      {onShare || onCancel ? (
        <View style={styles.actions}>
          {onShare ? (
            <View style={styles.actionCell}>
              <Button title="🔗 Share Tracking" variant="secondary" onPress={onShare} />
            </View>
          ) : null}
          {onCancel ? (
            <View style={styles.actionCell}>
              <Button title={cancelLabel} variant="outline" onPress={onCancel} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function TrackStatus({ label, status }) {
  return <StatusBadge label={label} status={status} />;
}

function initialsFrom(name) {
  return String(name || 'ZY')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function personFrom(name, subtitle) {
  return {
    initials: initialsFrom(name),
    name: name || 'Assignment pending',
    subtitle: subtitle || 'Specialist will appear after assignment',
  };
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  map: {
    height: 220,
    overflow: 'hidden',
    position: 'relative',
  },
  webmap: {
    flex: 1,
  },
  mapLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  route: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 78,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  dotStart: {
    position: 'absolute',
    left: 16,
    bottom: 36,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  dotLive: {
    position: 'absolute',
    left: '38%',
    top: 62,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 4,
  },
  dotEnd: {
    position: 'absolute',
    right: 16,
    top: 28,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  livePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  mapTag: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  etaTag: {
    right: 10,
    bottom: 10,
  },
  distanceTag: {
    left: 10,
    bottom: 10,
    maxWidth: '52%',
  },
  openMapTag: {
    right: 10,
    top: 34,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  person: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  location: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
  },
  locationIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  roundAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
  },
  timelineRail: {
    width: 18,
    alignItems: 'center',
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 22,
    marginVertical: 3,
  },
  timelineCopy: {
    flex: 1,
    paddingBottom: 14,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCell: {
    flex: 1,
  },
});
