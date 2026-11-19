import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { EmptyState } from '../../../components/EmptyState';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { IllustrationCard } from '../../../components/ui/IllustrationCard';
import { MiniCard } from '../../../components/ui/MiniCard';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

const SERVICE_GLYPH = {
  electrician: 'bolt',
  panel_mcc: 'hammer',
  cabling: 'wrench',
  electrical_safety_audit: 'cert',
  vfd_servo: 'spark',
  plc: 'device',
  hmi: 'user',
  scada: 'pin',
};

const HIDDEN_SERVICE_CODES = new Set(['scada', 'hmi', 'electrical_safety_audit']);
const SERVICE_ORDER = ['electrician', 'plc', 'vfd_servo', 'panel_mcc', 'cabling'];
export function ServiceCategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const scrollRef = useRef(null);
  const { colors, radius, type } = useTheme();
  const { patch } = useFlowDraft();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [openingId, setOpeningId] = useState('');
  const routeQuery = String((route.params && route.params.query) || '').trim().toLowerCase();
  const routeCategoryCode = String((route.params && route.params.categoryCode) || '').trim().toLowerCase();
  const selectableCategories = useMemo(
    () => categories
      .filter((category) => !HIDDEN_SERVICE_CODES.has(String(category.code || '').toLowerCase()))
      .sort((left, right) => {
        const leftIndex = SERVICE_ORDER.indexOf(String(left.code || '').toLowerCase());
        const rightIndex = SERVICE_ORDER.indexOf(String(right.code || '').toLowerCase());
        return (leftIndex === -1 ? SERVICE_ORDER.length : leftIndex)
          - (rightIndex === -1 ? SERVICE_ORDER.length : rightIndex);
      }),
    [categories],
  );

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await customerApi.serviceCategories();
      setCategories((data && data.categories) || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false });
    load();
  }, [load]));

  // Resolve the list from the linked card: exact category code first, then a
  // name/summary match, then fall back to the full list. External links (e.g.
  // Dashboard service cards) may name a different catalog, so an unmatched
  // query must never render an empty screen.
  const { visible, matchedIds } = useMemo(() => {
    if (!routeCategoryCode && !routeQuery) return { visible: selectableCategories, matchedIds: new Set() };
    const byCode = routeCategoryCode
      ? selectableCategories.filter((category) => String(category.code || '').toLowerCase() === routeCategoryCode)
      : [];
    const primary = byCode.length
      ? byCode
      : routeQuery
        ? selectableCategories.filter((category) => `${category.name} ${category.summary || ''}`.toLowerCase().includes(routeQuery))
        : [];
    if (!primary.length) return { visible: selectableCategories, matchedIds: new Set() };
    const primaryIds = new Set(primary.map((category) => category.id));
    return {
      visible: [...primary, ...selectableCategories.filter((category) => !primaryIds.has(category.id))],
      matchedIds: primaryIds,
    };
  }, [selectableCategories, routeCategoryCode, routeQuery]);

  async function choose(category) {
    if (openingId) return;
    setOpeningId(category.id);
    setError('');
    setFormError('');
    try {
      const body = {
        categoryId: category.id,
        categoryCode: category.code,
        categoryName: category.name,
        categorySummary: category.summary || '',
        categoryIntro: category.intro || '',
        categoryGlyph: category.iconKey || SERVICE_GLYPH[category.code] || 'spark',
        steps: [],
        trail: [],
        answers: {},
        siteId: '',
        siteName: '',
        preferredDate: '',
        preferredTime: '',
        attachmentIds: [],
        pendingAttachments: [],
      };
      const data = await customerApi.serviceCategory(category.id);
      if (!data || !Array.isArray(data.steps) || data.steps.length === 0) {
        setFormError('This service form is not configured yet. Please select another service or contact support.');
        return;
      }
      patch({ ...body, steps: data.steps });
      navigation.navigate('ServiceStep');
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setOpeningId('');
    }
  }

  const openCode = route.params && route.params.openCode;
  useEffect(() => {
    if (!openCode || !categories.length) return;
    navigation.setParams({ openCode: undefined });
    const match = selectableCategories.find((category) => category.code === openCode);
    if (match) choose(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCode, categories]);

  return (
    <Screen
      header={<AppBar title="Quick Services" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
      refreshing={!loading && categories.length > 0}
      onRefresh={() => { setLoading(true); load(); }}
      scrollRef={scrollRef}
    >
      <IllustrationCard
        glyph="spark"
        tone="teal"
        badge="AI MATCH"
        title="Smart specialist matching"
        detail="Pick a category — we match certified engineers by machine type, make, and site location."
      />

      <View style={[styles.hint, { backgroundColor: colors.orangeLight, borderRadius: radius.card }]}>
        <Text style={[type.heading, { color: colors.orange }]}>Not sure which to pick?</Text>
        <Text style={type.small}>VFD / Servo Drive — Drive error or fault → Engineer visits site</Text>
        <Text style={type.small}>Panel / MCC — Panel fault, wiring issue → Engineer visits site</Text>
        <Text style={type.small}>Projects — New panel, VFD, system → Design + quote + install</Text>
      </View>

      <Text style={type.label}>Select a service</Text>
      {loading && categories.length === 0 ? <SkeletonStack rows={4} /> : null}
      {!loading && error ? (
        <ErrorState title="Unable to load services" message={error} onRetry={load} />
      ) : null}
      {formError ? <ErrorState title="Unable to open this service" message={formError} /> : null}
      {!loading && !error && selectableCategories.length === 0 ? (
        <EmptyState glyph="book" title="No services available" message="Active service categories will show here." />
      ) : null}

      <View style={styles.grid}>
        {Array.from({ length: Math.ceil(visible.length / 2) }, (_, rowIndex) => {
          const row = visible.slice(rowIndex * 2, rowIndex * 2 + 2);
          return (
            <View key={`service-row-${rowIndex}`} style={styles.cardRow}>
              {row.map((category) => (
                <MiniCard
                  key={category.id}
                  style={row.length === 1 ? [styles.cell, styles.fullCell] : styles.cell}
                  cardStyle={styles.serviceCard}
                  glyph={category.iconKey || SERVICE_GLYPH[category.code] || 'calendar'}
                  tone="primary"
                  selected={matchedIds.has(category.id)}
                  title={openingId === category.id ? 'Opening…' : category.name}
                  subtitle={category.summary}
                  subtitleLines={2}
                  onPress={() => choose(category)}
                />
              ))}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ai: {
    gap: 8,
  },
  aiHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hint: {
    padding: 14,
    gap: 6,
  },
  grid: {
    gap: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  fullCell: {
    flex: 0,
    width: '100%',
  },
  serviceCard: {
    minHeight: 120,
    padding: 8,
    gap: 4,
  },
});
