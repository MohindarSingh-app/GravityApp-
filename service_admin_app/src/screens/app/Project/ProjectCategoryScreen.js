import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { DepthCard } from '../../../components/DepthCard';
import { EmptyState } from '../../../components/EmptyState';
import { FlowScreen } from '../../../components/FlowScreen';
import { Card } from '../../../components/ui/Card';
import { SkeletonStack } from '../../../components/Skeleton';
import { projectCategoryPresentation } from '../../../flows/customerFlow';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

export function ProjectCategoryScreen() {
  const navigation = useNavigation();
  const { colors, type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await customerApi.projectCategories();
      setCategories((data && data.categories) || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function choose(category) {
    const same = draft.categoryCode === category.code;
    const presentation = projectCategoryPresentation(category.code);
    patch({
      categoryCode: category.code,
      categoryName: presentation ? presentation.title : category.name,
      ...(same ? {} : {
        projectTypeCode: '',
        projectTypeName: '',
        fields: [],
        title: '',
        siteId: '',
        siteName: '',
        description: '',
        requirements: '',
        estimatedScope: '',
        preferredTimeline: '',
        budgetAmount: '',
        consultationType: '',
        consultationTypeLabel: '',
        projectDetailValues: {},
        pendingAttachments: [],
        preferredDate: '',
        preferredTime: '',
      }),
    });
    navigation.navigate('ProjectType');
  }

  return (
    <FlowScreen
      title="New project"
      steps={['Category', 'Type', 'Details', 'Confirm', 'Done']}
      step={0}
      onBack={() => navigation.goBack()}
      error={error}
      refreshing={loading && categories.length > 0}
      onRefresh={load}
    >
      <Text style={type.display} accessibilityRole="header">New project</Text>
      <Card style={[styles.intro, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft }]}>
        <Text style={[type.heading, { color: colors.primary }]}>Projects — Design, Supply & Install</Text>
        <Text style={type.body}>
          This section is for new installations, not repairs. Tell us what you need built; our team will assess, design, and quote before work begins.
        </Text>
      </Card>
      <Text style={type.label}>What do you need installed?</Text>
      {loading && categories.length === 0 ? <SkeletonStack rows={4} /> : null}
      {!loading && !error && categories.length === 0 ? (
        <EmptyState title="No project categories" message="The project menu has not been loaded for this company." />
      ) : null}
      <View style={styles.grid}>
        {categories.map((category, index) => {
          const presentation = projectCategoryPresentation(category.code);
          const glyphs = {
            electrical: 'bolt',
            automation: 'device',
            cabling: 'cable',
            plant_expansion: 'plant',
          };
          return (
            <View
              key={category.code}
              style={[
                styles.cardCell,
                index === categories.length - 1 && categories.length % 2 === 1 && styles.lastCardCell,
              ]}
            >
              <DepthCard
                tone="project"
                glyph={glyphs[category.code] || 'spark'}
                compact
                title={presentation ? presentation.title : category.name}
                detail={presentation ? presentation.detail : `${(category.types || []).length} project types`}
                onPress={() => choose(category)}
              />
            </View>
          );
        })}
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardCell: {
    width: '48%',
  },
  lastCardCell: {
    width: '100%',
  },
});
