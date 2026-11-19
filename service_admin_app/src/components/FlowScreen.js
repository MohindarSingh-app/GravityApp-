import { AppBar } from './AppBar';
import { Banner } from './Banner';
import { Screen } from './Screen';
import { StepBar } from './StepBar';
import { useTheme } from '../theme/ThemeContext';
import { getErrorMessage } from '../utils/errors';

function bannerMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return getErrorMessage(error);
}

export function FlowScreen({
  title,
  onBack,
  steps,
  step = 0,
  error,
  footer,
  refreshing,
  onRefresh,
  scrollRef,
  stickySteps = true,
  children,
}) {
  const { colors } = useTheme();
  const stepsBar = steps ? <StepBar steps={steps} step={step} /> : null;
  return (
    <Screen
      header={<AppBar title={title} onBack={onBack} />}
      headerColor={colors.background}
      scrollRef={scrollRef}
      footer={footer}
      refreshing={refreshing}
      onRefresh={onRefresh}
      stickyTop={stickySteps ? stepsBar : null}
      stickyTopTransparent={stickySteps}
    >
      {!stickySteps ? stepsBar : null}
      <Banner message={bannerMessage(error)} />
      {children}
    </Screen>
  );
}
