import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { DepthCard } from '../../../components/DepthCard';
import { EmptyState } from '../../../components/EmptyState';
import { FlowScreen } from '../../../components/FlowScreen';
import { SkeletonStack } from '../../../components/Skeleton';
import { projectFields, projectTypePresentation } from '../../../flows/customerFlow';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

export function ProjectTypeScreen() {
  const navigation = useNavigation();
  const { type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!draft.categoryCode) {
      setTypes([]);
      setLoading(false);
      setError('Choose a category first.');
      return;
    }
    setError('');
    try {
      const data = await customerApi.projectCategories();
      const categories = (data && data.categories) || [];
      const category = categories.find((item) => item.code === draft.categoryCode);
      setTypes(category ? category.types || [] : []);
      if (!category) setError('That category is no longer available.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [draft.categoryCode]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function choose(project) {
    const same = draft.projectTypeCode === project.code;
    const presentation = projectTypePresentation(project.code);
    patch({
      projectTypeCode: project.code,
      projectTypeName: presentation ? presentation.title : project.name,
      fields: projectFields(project.code),
      ...(same ? {} : {
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
    navigation.navigate('ProjectDetails');
  }

  return (
    <FlowScreen
      title="Project type"
      steps={['Category', 'Type', 'Details', 'Confirm', 'Done']}
      step={1}
      onBack={() => navigation.goBack()}
      error={error}
      refreshing={loading && types.length > 0}
      onRefresh={load}
    >
      <Text style={type.display} accessibilityRole="header">{draft.categoryName || 'Project type'}</Text>
      <Text style={type.muted}>These are the project types for this category.</Text>
      {loading && types.length === 0 ? <SkeletonStack rows={4} /> : null}
      {!loading && types.length === 0 && !error ? (
        <EmptyState title="No types in this category" message="Go back and choose another category." />
      ) : null}
      <View style={styles.grid}>
        {types.map((project, index) => (
          <View
            key={project.code}
            style={[
              styles.cardCell,
              index === types.length - 1 && types.length % 2 === 1 && styles.lastCardCell,
            ]}
          >
            <DepthCard
              tone="project"
              glyph="spark"
              compact
              kicker={draft.projectTypeCode === project.code ? 'Selected' : undefined}
              title={projectTypePresentation(project.code)?.title || project.name}
              detail={projectTypePresentation(project.code)?.detail || project.summary}
              onPress={() => choose(project)}
            />
          </View>
        ))}
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
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
