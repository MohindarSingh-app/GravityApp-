import { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo, findNodeHandle, Image, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { customerApi, fieldApi } from '../../../api/resources';
import { dialPhone, supportPhoneFromEnv } from '../../../constants/supportContact';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { Glyph } from '../../../components/Glyph';
import { Select } from '../../../components/ui/Select';
import { Card } from '../../../components/ui/Card';
import { useCatalog } from '../../../flows/useCatalog';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';
import { toneInk } from '../../../theme/tokens';
import { getErrorMessage } from '../../../utils/errors';
import { pickAttachmentPhotos } from '../../../utils/pickAttachments';
import { useFormNavigationField } from '../../../components/forms/FormNavigation';

const EMERGENCY_PHONE = supportPhoneFromEnv();

export function EmergencyScreen() {
  const navigation = useNavigation();
  const { colors, radius, type } = useTheme();
  const { sites, reload: reloadSites } = useCompanySites();
  const catalog = useCatalog('emergency_problem', 'emergency_sla');
  const slaOptions = catalog.groups.emergency_sla;
  const problemItems = catalog.groups.emergency_problem;
  const problemOptions = problemItems.map((item) => ({ value: item.label, label: item.label }));
  const customProblem = problemItems.find((item) => item.meta && item.meta.custom);
  const [siteId, setSiteId] = useState('');
  const [exact, setExact] = useState('');
  const [problem, setProblem] = useState('');
  const [otherProblem, setOtherProblem] = useState('');
  const [slaChoice, setSla] = useState('');
  const sla = slaChoice || (slaOptions[0] && slaOptions[0].code) || '';
  const isCustomProblem = Boolean(customProblem && problem === customProblem.label);
  const [detail, setDetail] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [submitStage, setSubmitStage] = useState('');
  const [error, setError] = useState('');
  const siteFieldRef = useRef(null);
  const firstSiteRef = useRef(null);
  const focusSiteField = useCallback(() => {
    const target = firstSiteRef.current && findNodeHandle(firstSiteRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const siteField = useFormNavigationField(focusSiteField, sites.length > 0, siteFieldRef);
  const slaFieldRef = useRef(null);
  const firstSlaRef = useRef(null);
  const focusSlaField = useCallback(() => {
    const target = firstSlaRef.current && findNodeHandle(firstSlaRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const slaField = useFormNavigationField(focusSlaField, slaOptions.length > 0, slaFieldRef);

  useFocusEffect(useCallback(() => {
    reloadSites();
  }, [reloadSites]));

  async function addPhotos() {
    setError('');
    const remaining = 5 - photos.length;
    if (remaining <= 0) {
      setError('You can attach up to 5 photos.');
      return;
    }
    try {
      const selected = await pickAttachmentPhotos(remaining);
      if (selected.length) {
        setPhotos((current) => [...current, ...selected].slice(0, 5));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function removePhoto(index) {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
  }

  async function callEmergencyLine() {
    setError('');
    try {
      await dialPhone(EMERGENCY_PHONE);
    } catch (err) {
      setError(getErrorMessage(err) || 'Unable to open the phone dialer on this device.');
    }
  }

  async function submit() {
    const site = sites.find((item) => item.id === siteId) || sites[0];
    if (!site) {
      setError('Choose a site first.');
      return;
    }
    const problemTitle = isCustomProblem ? otherProblem.trim() : problem.trim();
    if (detail.trim().length < 2 && problemTitle.length < 2) {
      setError('Describe what happened so the engineer can prepare.');
      return;
    }
    const selectedSla = slaOptions.find((option) => option.code === sla);
    if (!selectedSla) {
      setError('Choose a response SLA.');
      return;
    }
    setBusy(true);
    setError('');
    let stage = 'Preparing your request';
    setSubmitStage(stage);
    const title = problemTitle || 'Emergency visit';
    const body = [
      exact.trim() ? `Location: ${exact.trim()}` : '',
      `SLA: ${selectedSla.label}`,
      detail.trim(),
    ].filter(Boolean).join(' · ');
    try {
      const attachmentIds = [];
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        let attachmentId = photo.attachmentId;
        if (!attachmentId) {
          stage = `Uploading photo ${index + 1} of ${photos.length}`;
          setSubmitStage(stage);
          const upload = {
            fileName: photo.fileName,
            mimeType: photo.mimeType,
            contentBase64: photo.contentBase64,
          };
          const result = await customerApi.uploadAttachment(upload);
          attachmentId = result && result.attachment && result.attachment.id;
          if (!attachmentId) {
            throw new Error('The server did not return an ID for the uploaded photo.');
          }
          setPhotos((current) => current.map((item) => (
            item === photo ? { ...item, attachmentId } : item
          )));
        }
        attachmentIds.push(attachmentId);
      }
      stage = 'Sending emergency request';
      setSubmitStage(stage);
      const result = await fieldApi.createSignal({
        kind: 'emergency',
        title,
        detail: body || title,
        siteId: site.id,
        attachmentIds,
        etaMinutes: selectedSla.meta && selectedSla.meta.minutes,
      });
      const signalId = result && result.signal && result.signal.id || '';
      const requestId = result && result.job && result.job.code || signalId;
      if (!requestId) {
        throw new Error('The server did not confirm the emergency request ID. Please contact support before retrying.');
      }
      navigation.navigate('EmergencyConfirmation', {
        requestId,
        signalId,
        jobId: result && result.job && result.job.id,
        job: result && result.job,
        responseSla: `${selectedSla.summary} — ${selectedSla.label}`,
        slaMinutes: selectedSla.meta && selectedSla.meta.minutes,
        location: [exact.trim(), site.siteName, site.city].filter(Boolean).join(' — '),
        issue: title,
      });
    } catch (err) {
      const diagnostic = [
        err && err.code ? `Code ${err.code}` : '',
        err && Number.isInteger(err.status) && err.status > 0 ? `HTTP ${err.status}` : '',
      ].filter(Boolean).join(' · ');
      setError(`${stage}: ${diagnostic ? `${diagnostic} — ` : ''}${getErrorMessage(err)}`);
    } finally {
      setBusy(false);
      setSubmitStage('');
    }
  }

  return (
    <Screen
      header={<AppBar title="Emergency Service" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
    >
      <View style={[styles.alert, { backgroundColor: colors.dangerSurface, borderRadius: radius.card }]}>
        <Text style={[type.heading, { color: colors.danger }]}>Production downtime = direct loss</Text>
        {slaOptions.length ? (
          <Text style={[type.small, { color: colors.danger }]}>
            {slaOptions
              .filter((option) => option.label.includes('+'))
              .map((option, index) => `${option.summary}${index === 0 ? ' guaranteed' : ''} (${option.label.split(' +')[0]})`)
              .join(' • ')}
          </Text>
        ) : null}
      </View>
      <View style={[styles.directCall, { backgroundColor: colors.dangerSurface, borderColor: colors.danger, borderRadius: radius.card }]}>
        <View style={styles.directCallCopy}>
          <Text style={[type.heading, { color: colors.danger }]}>Machine down right now?</Text>
          <Text style={[type.small, { color: colors.danger }]}>Call our emergency line directly — skip the form</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Call Now"
          onPress={callEmergencyLine}
          style={({ pressed }) => [
            styles.callButton,
            { backgroundColor: colors.dangerSolid, borderRadius: radius.button },
            pressed && styles.callButtonPressed,
          ]}
        >
          <Glyph name="call" color={colors.onDanger} size={15} />
          <Text style={[type.small, styles.callButtonText, { color: colors.onDanger }]}>Call Now</Text>
        </Pressable>
      </View>

      <Text style={type.label}>Or fill quick details</Text>
      <View
        ref={siteFieldRef}
        collapsable={false}
        accessibilityRole="radiogroup"
        accessibilityLabel="Site / Unit Location"
      >
        <Text style={type.small}>Site / Unit Location</Text>
        {sites.map((site, index) => {
          const selected = siteId ? site.id === siteId : site.isPrimary;
          return (
            <Pressable
              key={site.id}
              ref={index === 0 ? firstSiteRef : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                setSiteId(site.id);
                siteField.advance();
              }}
              style={[
                styles.site,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: radius.card,
                },
              ]}
            >
              <View style={[styles.siteIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.sm }]}>
                <Glyph name="pin" color={colors.primary} size={18} />
              </View>
              <View style={styles.flex}>
                <Text style={type.heading}>{site.siteName}</Text>
                <Text style={type.small}>{site.fullAddress || site.city}</Text>
              </View>
              <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.borderStrong, backgroundColor: selected ? colors.primary : colors.surface }]} />
            </Pressable>
          );
        })}
        <Button
          title="+ Add New Site"
          variant="secondary"
          onPress={() => {
            const parent = navigation.getParent();
            if (parent) parent.navigate('SitesList');
          }}
        />
      </View>

      <TextField
        label="Exact location (optional)"
        value={exact}
        onChangeText={setExact}
        placeholder="e.g. Unit 3, Production Floor, near Panel-2"
      />
      <Select
        label="Problem Type"
        value={problem}
        onChange={setProblem}
        options={problemOptions}
        placeholder={catalog.loading && !problemOptions.length ? 'Loading issues…' : 'Select the issue…'}
      />
      {isCustomProblem ? (
        <TextField
          label="Describe the problem type"
          value={otherProblem}
          onChangeText={setOtherProblem}
          placeholder="Enter the problem type"
        />
      ) : null}

      <View
        ref={slaFieldRef}
        collapsable={false}
        accessibilityRole="radiogroup"
        accessibilityLabel="Response SLA"
      >
        <Text style={type.label}>Response SLA</Text>
        <View style={styles.slaRow}>
          {slaOptions.map((option, index) => {
            const selected = sla === option.code;
            const ink = toneInk(colors, option.tone);
            return (
              <Pressable
                key={option.code}
                ref={index === 0 ? firstSlaRef : undefined}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  setSla(option.code);
                  slaField.advance();
                }}
                style={[
                  styles.sla,
                  selected && styles.slaSelected,
                  {
                    borderColor: ink.fg,
                    backgroundColor: ink.bg,
                    borderRadius: radius.card,
                  },
                ]}
              >
                <Text style={[type.heading, { color: ink.fg }]}>{option.summary}</Text>
                <Text style={[type.small, { color: ink.fg }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {!catalog.loading && catalog.error && !slaOptions.length ? (
        <Banner message={catalog.error} tone="warning" />
      ) : null}

      <TextField
        label="Description"
        value={detail}
        onChangeText={setDetail}
        placeholder="What happened? Describe in detail..."
        multiline
      />

      <Card
        onPress={addPhotos}
        accessibilityLabel="Add photos of the fault, panel, or machine"
        style={styles.photoCard}
      >
        <View style={styles.photoHeader}>
          <View style={[styles.photoIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.chip }]}>
            <Glyph name="camera" color={colors.primary} size={20} />
          </View>
          <View style={styles.photoCopy}>
            <Text style={type.heading}>Photo of the fault / panel / machine</Text>
            <Text style={type.small}>Max 5</Text>
          </View>
          <Glyph name="plus" color={colors.primary} size={20} />
        </View>
        {photos.length ? (
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <View key={`${photo.fileName}-${index}`} style={styles.photoItem}>
                <Image source={{ uri: photo.previewUri }} style={styles.photoPreview} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  onPress={() => removePhoto(index)}
                  hitSlop={8}
                  style={[styles.removePhoto, { backgroundColor: colors.danger, borderColor: colors.surface }]}
                >
                  <Glyph name="close" color={colors.onDanger} size={11} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={type.small}>Photos (optional — helps engineer prepare)</Text>
      </Card>

      <View style={[styles.note, { backgroundColor: colors.successSurface, borderRadius: radius.md }]}>
        <Text style={[styles.noteText, { color: colors.success }]}>
          A certified specialist is assigned after you send the request. GST invoice + work report will be provided.
        </Text>
      </View>
      <Banner message={error} />
      <Button
        title={busy ? submitStage : '⚡ Send Emergency Request'}
        loading={busy}
        onPress={submit}
      />
      <Pressable onPress={() => navigation.goBack()} style={styles.cancel}>
        <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel and go back</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  alert: {
    padding: 16,
    gap: 8,
  },
  directCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  directCallCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  callButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  callButtonText: {
    fontWeight: '800',
  },
  callButtonPressed: {
    opacity: 0.85,
  },
  flex: {
    flex: 1,
  },
  site: {
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  siteIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  slaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sla: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: 4,
  },
  slaSelected: {
    borderWidth: 2,
  },
  photoCard: {
    gap: 12,
  },
  photoHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  photoIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCopy: {
    flex: 1,
    gap: 2,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  photoItem: {
    flex: 1,
    aspectRatio: 1,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    padding: 12,
  },
  noteText: {
    fontWeight: '700',
  },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontWeight: '600',
  },
});
