import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppBar } from '../../../components/AppBar';
import { Screen } from '../../../components/Screen';
import { useTheme } from '../../../theme/ThemeContext';

const SECTIONS = [
  {
    title: 'Gravity Hub Service App — License',
    body: 'This build of the Gravity Hub Service app is licensed to the customer company workspace configured during onboarding. Use of emergency dispatch, service booking, AMC, marketplace ordering and support features is governed by the Gravity Hub service agreement and applicable order documents.',
  },
  {
    title: 'Acceptable use',
    body: 'Use a verified company account. Keep OTPs and API keys private. Upload only work-related photos and documents you are allowed to share. Do not misuse emergency dispatch or submit false service requests.',
  },
  {
    title: 'Data and privacy',
    body: 'Company, site, job, AMC, project, order and support records sync with the Gravity Hub backend for your workspace. Photos and documents are stored privately per company and served only to authorized workspace members.',
  },
  {
    title: 'Open-source notices',
    body: 'This app is built with React Native, Expo, React Navigation and other open-source libraries. Their respective licenses apply to those components. Map tiles and directions are provided by Google Maps when tracking is opened.',
  },
];

export function LicenseScreen() {
  const navigation = useNavigation();
  const { colors, type } = useTheme();
  return (
    <Screen header={<AppBar title="License" onBack={() => navigation.goBack()} />}>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.block}>
          <Text style={type.heading}>{section.title}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{section.body}</Text>
        </View>
      ))}
      <ScrollView style={styles.note} scrollEnabled={false}>
        <Text style={[type.small, { color: colors.textTertiary }]}>Version 1.0.0 · Gravity Hub Service Admin</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  note: {
    marginTop: 8,
  },
});