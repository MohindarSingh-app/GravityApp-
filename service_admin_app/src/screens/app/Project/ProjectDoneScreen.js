import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Facts } from '../../../components/Facts';
import { FlowScreen } from '../../../components/FlowScreen';
import {
  labelStatus,
  projectCategoryPresentation,
  projectTypeDetailFields,
  projectTypePresentation,
  siteLabel,
} from '../../../flows/customerFlow';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';

export function ProjectDoneScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { type } = useTheme();
  const { sites } = useCompanySites();
  const projectRequest = route.params && route.params.projectRequest;
  const confirmation = route.params && route.params.confirmation;
  const accepted = Boolean(
    confirmation
    && confirmation.projectRequestId
    && confirmation.status === 'submitted'
    && projectRequest,
  );

  function backToProjects() {
    navigation.popToTop();
  }

  if (!accepted) {
    return (
      <FlowScreen title="Done" onBack={backToProjects}>
        <EmptyState
          title="No project request yet"
          message="This screen opens after the service accepts the project."
          action={<Button title="Back to projects" variant="secondary" onPress={backToProjects} />}
        />
      </FlowScreen>
    );
  }

  const budget = projectRequest.budget
    ? `${projectRequest.budget.currency} ${projectRequest.budget.amount}`
    : '';
  const categoryPresentation = projectCategoryPresentation(projectRequest.category);
  const typePresentation = projectTypePresentation(projectRequest.projectType);
  const typeFields = projectTypeDetailFields(projectRequest.projectType);
  const details = (projectRequest.details || [])
    .filter((detail) => detail.value)
    .map((detail) => {
      const field = typeFields.find((item) => item.key === detail.key);
      return {
        label: detail.key === 'consultation_type'
          ? 'Consultation'
          : field ? field.label : labelStatus(detail.key),
        value: detail.value,
      };
    });

  return (
    <FlowScreen
      title="Done"
      steps={['Category', 'Type', 'Details', 'Confirm', 'Done']}
      step={4}
      onBack={backToProjects}
      footer={<Button title="Back to projects" onPress={backToProjects} />}
    >
      <Text style={type.display} accessibilityRole="header">Booking Confirmed!</Text>
      <Facts
        rows={[
          { label: 'Reference', value: confirmation.projectRequestId },
          { label: 'Status', value: labelStatus(confirmation.status) },
          { label: 'Category', value: categoryPresentation ? categoryPresentation.title : projectRequest.categoryName },
          { label: 'Project type', value: typePresentation ? typePresentation.title : projectRequest.projectTypeName },
          { label: 'Site', value: siteLabel(sites, projectRequest.siteId) },
          { label: 'Title', value: projectRequest.title },
          { label: 'Timeline', value: projectRequest.preferredTimeline },
          { label: 'Budget', value: budget },
          ...details,
        ]}
      />
    </FlowScreen>
  );
}
