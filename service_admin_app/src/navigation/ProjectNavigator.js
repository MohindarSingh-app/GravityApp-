import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FlowDraftProvider } from '../flows/FlowDraft';
import { ProjectCategoryScreen } from '../screens/app/Project/ProjectCategoryScreen';
import { ProjectDetailsScreen } from '../screens/app/Project/ProjectDetailsScreen';
import { ProjectDoneScreen } from '../screens/app/Project/ProjectDoneScreen';
import { ProjectReviewScreen } from '../screens/app/Project/ProjectReviewScreen';
import { ProjectTypeScreen } from '../screens/app/Project/ProjectTypeScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

export function ProjectNavigator() {
  const screenOptions = useStackScreenOptions();
  return (
    <FlowDraftProvider>
      <Stack.Navigator initialRouteName="ProjectCategory" screenOptions={screenOptions}>
        <Stack.Screen name="ProjectCategory" component={ProjectCategoryScreen} />
        <Stack.Screen name="ProjectType" component={ProjectTypeScreen} />
        <Stack.Screen name="ProjectDetails" component={ProjectDetailsScreen} />
        <Stack.Screen name="ProjectReview" component={ProjectReviewScreen} />
        <Stack.Screen name="ProjectDone" component={ProjectDoneScreen} />
      </Stack.Navigator>
    </FlowDraftProvider>
  );
}
