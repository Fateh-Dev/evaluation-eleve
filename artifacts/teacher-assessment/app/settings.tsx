import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AppHeader,
  Button,
  KeyboardAvoidingViewCompat,
  Screen,
  SectionTitle,
  Surface,
} from '@/components/AppShell';
import { PinEntryScreen } from '@/components/PinEntryScreen';
import { RecoveryCodeDialog } from '@/components/RecoveryCodeDialog';
import { useAppData } from '@/context/AppDataContext';
import { useReminders } from '@/context/ReminderContext';
import { useSecurity } from '@/context/SecurityContext';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const data = useAppData();
  const reminders = useReminders();
  const security = useSecurity();
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [editingPin, setEditingPin] = useState(false);
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [creatingRecoveryCode, setCreatingRecoveryCode] = useState(false);
  const [recoveryPinInput, setRecoveryPinInput] = useState('');
  const [recoveryPinError, setRecoveryPinError] = useState('');
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetActionArmed, setResetActionArmed] = useState(false);
  const [resetStage, setResetStage] = useState<'confirm' | 'pin' | 'type'>('confirm');
  const [resetPin, setResetPin] = useState('');
  const [resetPinError, setResetPinError] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [generatingTestData, setGeneratingTestData] = useState(false);

  // Teacher Name Edit State
  const [editingTeacher, setEditingTeacher] = useState(false);
  const [teacherNameInput, setTeacherNameInput] = useState(
    data.teacherName || '',
  );

  // School Edit State
  const [editingSchool, setEditingSchool] = useState(false);
  const [schoolNameInput, setSchoolNameInput] = useState(
    data.school.name || '',
  );
  const [schoolWilayaInput, setSchoolWilayaInput] = useState(
    data.school.wilaya || '',
  );

  const handleSaveTeacher = () => {
    data.updateTeacherName(teacherNameInput.trim());
    setEditingTeacher(false);
    Alert.alert('Succès', 'Nom de l’enseignant mis à jour.');
  };

  const handleSaveSchool = () => {
    data.updateSchool({
      name: schoolNameInput.trim(),
      wilaya: schoolWilayaInput.trim(),
    });
    setEditingSchool(false);
    Alert.alert('Succès', 'Informations de l’établissement enregistrées.');
  };

  const handleReminderToggle = async (enabled: boolean) => {
    const updated = await reminders.setEnabled(enabled);
    if (enabled && !updated) {
      Alert.alert('Autorisation requise', 'Autorisez les notifications dans les réglages de votre appareil pour recevoir les rappels.');
    }
  };

  const handleTestReminder = async () => {
    const scheduled = await reminders.sendTestNotification();
    Alert.alert(
      scheduled ? 'Notification de test programmée' : 'Test impossible',
      scheduled
        ? 'Une notification de test devrait apparaître dans quelques secondes.'
        : 'Vérifiez l’autorisation des notifications et les réglages de votre appareil.',
    );
  };

  const handleCreateBackup = async () => {
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const uri = `${FileSystem.cacheDirectory}evaluation-eleve-${timestamp}.json`;
      const backupState = data.getBackupState();
      await FileSystem.writeAsStringAsync(uri, JSON.stringify({
        format: 'evaluation-eleve-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        includedCollections: [
          'school', 'teacherName', 'academicYear', 'schoolYearConfigurations',
          'classes', 'pupils', 'assessments', 'objectives', 'evaluations',
          'absentPupilIds', 'remediations', 'activeClassId', 'activeAssessmentId',
        ],
        counts: {
          classes: backupState.classes.length,
          pupils: backupState.pupils.length,
          assessments: backupState.assessments.length,
          schoolYearConfigurations: backupState.schoolYearConfigurations.length,
        },
        state: backupState,
      }, null, 2));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Enregistrer la sauvegarde' });
      else Alert.alert('Sauvegarde créée', `Le fichier est disponible ici : ${uri}`);
    } catch { Alert.alert('Erreur', 'Impossible de créer la sauvegarde.'); }
  };
  const handleRestoreBackup = async () => {
    try {
      const result = await File.pickFileAsync({ mimeTypes: ['application/json'] });
      if (result.canceled || !result.result) return;
      const raw = await result.result.text();
      const parsed = JSON.parse(raw) as { format?: string; state?: unknown };
      const backup = parsed.format === 'evaluation-eleve-backup' ? parsed.state : parsed;
      Alert.alert('Restaurer cette sauvegarde ?', 'Les données actuelles seront remplacées par celles du fichier sélectionné.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Restaurer', onPress: () => { void data.restoreBackupState(backup).then(() => Alert.alert('Restauration terminée', 'Vos données ont été restaurées.')).catch((error: Error) => Alert.alert('Erreur', error.message)); } },
      ]);
    } catch { Alert.alert('Erreur', 'Le fichier sélectionné est invalide ou illisible.'); }
  };
  const closePinSetup = () => {
    setEditingPin(false);
    setConfirmingPin(false);
    setPinInput('');
    setPinConfirmation('');
    setPinError('');
  };
  const handleSavePin = async (pin: string) => {
    try {
      const code = await security.setPin(pin);
      closePinSetup();
      setRecoveryCode(code);
    } catch {
      setPinError('Impossible d’enregistrer le code PIN. Réessayez.');
      setPinConfirmation('');
    }
  };
  const handlePinDigit = (digit: string) => {
    setPinError('');
    if (!confirmingPin) {
      const nextPin = `${pinInput}${digit}`;
      if (nextPin.length > 4) return;
      setPinInput(nextPin);
      if (nextPin.length === 4) {
        setPinConfirmation('');
        setConfirmingPin(true);
      }
      return;
    }
    const nextConfirmation = `${pinConfirmation}${digit}`;
    if (nextConfirmation.length > 4) return;
    setPinConfirmation(nextConfirmation);
    if (nextConfirmation.length === 4) {
      if (nextConfirmation !== pinInput) {
        setPinConfirmation('');
        setPinError('Les codes ne correspondent pas. Réessayez.');
        return;
      }
      void handleSavePin(nextConfirmation);
    }
  };
  const handlePinBackspace = () => {
    setPinError('');
    if (confirmingPin) setPinConfirmation((current) => current.slice(0, -1));
    else setPinInput((current) => current.slice(0, -1));
  };
  const handleRemovePin = () => Alert.alert('Désactiver le code PIN ?', 'La protection de l’application sera retirée sur cet appareil.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Désactiver', style: 'destructive', onPress: () => { void security.removePin(); } },
  ]);
  const handleRecoveryPinDigit = (digit: string) => {
    if (recoveryPinInput.length >= 4) return;
    const nextPin = `${recoveryPinInput}${digit}`;
    setRecoveryPinInput(nextPin);
    setRecoveryPinError('');
    if (nextPin.length !== 4) return;
    void security.createRecoveryCode(nextPin).then((code) => {
      setRecoveryPinInput('');
      if (!code) {
        setRecoveryPinError('Code PIN incorrect.');
        return;
      }
      setCreatingRecoveryCode(false);
      setRecoveryPinError('');
      setRecoveryCode(code);
    }).catch(() => {
      setRecoveryPinInput('');
      setRecoveryPinError('Impossible de générer le code sécurisé. Réessayez.');
    });
  };
  const handleToggleBiometric = async () => {
    if (security.biometricEnabled) {
      await security.setBiometricEnabled(false);
      Alert.alert('Biométrie désactivée', 'Le code PIN reste disponible pour déverrouiller l’application.');
      return;
    }
    if (!security.hasPin) {
      Alert.alert('Code PIN requis', 'Activez d’abord un code PIN avant d’utiliser la biométrie.');
      return;
    }
    if (!security.biometricAvailable) {
      Alert.alert('Biométrie indisponible', 'Aucun visage ou aucune empreinte enregistrée n’est disponible sur cet appareil.');
      return;
    }
    if (await security.authenticateBiometric()) {
      await security.setBiometricEnabled(true);
      Alert.alert('Biométrie activée', 'Vous pourrez utiliser votre visage ou votre empreinte pour ouvrir l’application.');
    }
  };
  const closeResetModal = () => {
    if (resetting) return;
    setResetModalVisible(false);
    setResetStage('confirm');
    setResetPin('');
    setResetPinError('');
    setResetConfirmation('');
    setResetError('');
  };
  const beginResetConfirmation = () => {
    setResetError('');
    if (security.hasPin) {
      setResetStage('pin');
      setResetPin('');
      setResetPinError('');
    } else {
      setResetStage('type');
    }
  };
  const handleResetPinDigit = (digit: string) => {
    if (resetPin.length >= 4) return;
    const nextPin = `${resetPin}${digit}`;
    setResetPin(nextPin);
    setResetPinError('');
    if (nextPin.length === 4) {
      void security.unlock(nextPin).then((valid) => {
        if (valid) {
          setResetPin('');
          setResetStage('type');
        } else {
          setResetPin('');
          setResetPinError('Code PIN incorrect.');
        }
      }).catch(() => {
        setResetPin('');
        setResetPinError('Vérification impossible. Réessayez.');
      });
    }
  };
  const authorizeResetWithBiometrics = async () => {
    try {
      if (await security.authenticateBiometric()) setResetStage('type');
    } catch {
      setResetPinError('La vérification biométrique a échoué. Utilisez le code PIN.');
    }
  };
  const handleResetData = async () => {
    if (resetConfirmation !== 'EFFACER' || resetting) return;
    setResetting(true);
    setResetError('');
    try {
      await data.resetAllData();
      setResetModalVisible(false);
      setResetStage('confirm');
      setResetConfirmation('');
      Alert.alert('Base réinitialisée', 'Toutes les données ont été effacées.');
    } catch {
      setResetError('La réinitialisation a échoué. Vos données n’ont pas été effacées.');
    } finally {
      setResetting(false);
    }
  };
  const confirmGenerateTestData = () => {
    if (generatingTestData) return;
    Alert.alert(
      'Générer des données de test ?',
      `Cette action remplacera les ${data.classes.length} classes, ${data.pupils.length} élèves, évaluations, présences et créneaux existants. Une sauvegarde automatique sera créée. Votre profil et les informations de l’établissement seront conservés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Remplacer et générer',
          style: 'destructive',
          onPress: () => { void handleGenerateTestData(); },
        },
      ],
    );
  };
  const handleGenerateTestData = async () => {
    setGeneratingTestData(true);
    try {
      const result = await data.generateTestData();
      Alert.alert(
        'Données de test générées',
        `${result.classCount} classes, ${result.pupilCount} élèves et ${result.weeklyHours} heures de cours par semaine.`,
      );
    } catch {
      Alert.alert(
        'Génération impossible',
        'Les données de test n’ont pas pu être enregistrées. Vos données existantes sont conservées.',
      );
    } finally {
      setGeneratingTestData(false);
    }
  };

  return (
    <Screen onTouchStart={() => setResetActionArmed(false)}>
      <AppHeader
        eyebrow="Configuration & Profil"
        title="Paramètres"
        onBack={() => router.back()}
      />

      <SectionTitle title="Rappels" />
      <Surface style={styles.card}>
        <View style={styles.reminderRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
            <Feather name="bell" size={18} color={colors.primary} />
          </View>
          <View style={styles.reminderCopy}>
            <Text style={[styles.value, { color: colors.foreground }]}>Cours et évaluations à venir</Text>
            <Text style={[styles.help, { color: colors.mutedForeground }]}>
              {reminders.available
                ? 'Recevez un rappel avant les séances et évaluations prévues.'
                : 'Les notifications sont disponibles dans l’application mobile.'}
            </Text>
          </View>
          <Switch
            value={reminders.enabled}
            disabled={!reminders.ready || !reminders.available}
            onValueChange={(enabled) => { void handleReminderToggle(enabled); }}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={reminders.enabled ? colors.primary : colors.card}
            accessibilityLabel="Activer les rappels de cours et d’évaluations"
          />
        </View>
        <View style={[styles.reminderStatus, { borderTopColor: colors.border }]}>
          <Feather
            name={reminders.permissionStatus === 'granted' ? 'check-circle' : reminders.permissionStatus === 'denied' ? 'slash' : 'info'}
            size={15}
            color={reminders.permissionStatus === 'granted' ? colors.successForeground : colors.mutedForeground}
          />
          <Text style={[styles.help, styles.reminderStatusText, { color: colors.mutedForeground }]}>
            {reminders.permissionStatus === 'granted'
              ? 'Autorisation de notification accordée'
              : reminders.permissionStatus === 'denied'
                ? 'Notifications refusées. Autorisez-les dans les réglages Android.'
                : reminders.permissionStatus === 'unavailable'
                  ? 'Notifications indisponibles sur cette plateforme'
                  : 'Autorisation de notification non accordée'}
          </Text>
        </View>
        {reminders.enabled ? (
          <>
            <View style={[styles.reminderTiming, { borderTopColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>ME RAPPELER</Text>
              <View style={styles.reminderOptions}>
                {[5, 10, 15, 30, 60].map((minutes) => {
                  const selected = reminders.minutesBefore === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => reminders.setMinutesBefore(minutes)}
                      style={[styles.reminderOption, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
                    >
                      <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontSize: 12, fontWeight: '700' }}>{minutes} min</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={[styles.reminderNext, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>PROCHAIN RAPPEL</Text>
              {reminders.nextReminder ? (
                <>
                  <Text style={[styles.value, { color: colors.foreground }]}>
                    {reminders.nextReminder.title} · {reminders.nextReminder.triggerAt.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={[styles.help, { color: colors.mutedForeground }]}>{reminders.nextReminder.body}</Text>
                </>
              ) : (
                <Text style={[styles.help, { color: colors.mutedForeground }]}>Aucune séance ou évaluation à rappeler dans les 7 prochains jours.</Text>
              )}
            </View>
          </>
        ) : null}
        <Button label="Tester la notification" icon="bell" secondary compact disabled={!reminders.available || !reminders.ready} onPress={() => { void handleTestReminder(); }} />
      </Surface>

      {/* PROFESSOR / TEACHER PROFILE */}
      <SectionTitle
        title="Enseignant(e) / Professeur"
        action={editingTeacher ? 'Annuler' : 'Modifier'}
        onAction={() => {
          if (!editingTeacher) setTeacherNameInput(data.teacherName || '');
          setEditingTeacher(!editingTeacher);
        }}
      />
      <Surface style={styles.card}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Feather name="user" size={24} color={colors.primary} />
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              NOM DE L'ENSEIGNANT
            </Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {data.teacherName
                ? data.teacherName
                : 'Non renseigné (ex: Mme Douad, M. Benali)'}
            </Text>
          </View>
        </View>

        {editingTeacher && (
          <View style={[styles.editBox, { borderTopColor: colors.border }]}>
            <Text
              style={[styles.fieldLabel, { color: colors.mutedForeground }]}
            >
              NOM ET TITRE DU PROFESSEUR
            </Text>
            <TextInput
              value={teacherNameInput}
              onChangeText={setTeacherNameInput}
              placeholder="Ex: Mme Fatima Zohra, M. Djawed"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              autoFocus
            />
            <View style={styles.buttonRow}>
              <Button
                label="Enregistrer"
                icon="check"
                compact
                onPress={handleSaveTeacher}
              />
              <Button
                label="Fermer"
                secondary
                compact
                onPress={() => setEditingTeacher(false)}
              />
            </View>
          </View>
        )}
      </Surface>

      {/* SCHOOL & ACADEMIC YEAR */}
      <SectionTitle
        title="Établissement & Année"
        action={editingSchool ? 'Annuler' : 'Modifier'}
        onAction={() => {
          if (!editingSchool) {
            setSchoolNameInput(data.school.name || '');
            setSchoolWilayaInput(data.school.wilaya || '');
          }
          setEditingSchool(!editingSchool);
        }}
      />
      <Surface style={styles.card}>
        <View style={styles.formRow}>
          <Feather name="home" size={17} color={colors.primary} />
          <View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              NOM DE L’ÉTABLISSEMENT
            </Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {data.school.name || 'Non renseigné'}
            </Text>
          </View>
        </View>

        <View style={styles.formRow}>
          <Feather name="map-pin" size={17} color={colors.primary} />
          <View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              WILAYA
            </Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {data.school.wilaya || 'Non renseigné'}
            </Text>
          </View>
        </View>

        <View style={styles.formRow}>
          <Feather name="calendar" size={17} color={colors.primary} />
          <View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              ANNÉE PAR DÉFAUT POUR LES NOUVELLES CLASSES
            </Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {data.academicYear}
            </Text>
          </View>
        </View>

        {editingSchool && (
          <View style={[styles.editBox, { borderTopColor: colors.border }]}>
            <View style={styles.inputGroup}>
              <Text
                style={[styles.fieldLabel, { color: colors.mutedForeground }]}
              >
                NOM DE L'ÉTABLISSEMENT
              </Text>
              <TextInput
                value={schoolNameInput}
                onChangeText={setSchoolNameInput}
                placeholder="Ex. Lycée Abdelhamid Douad"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.fieldLabel, { color: colors.mutedForeground }]}
              >
                WILAYA
              </Text>
              <TextInput
                value={schoolWilayaInput}
                onChangeText={setSchoolWilayaInput}
                placeholder="Ex. Alger, Oran, Constantine"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
            </View>

            <View style={styles.buttonRow}>
              <Button
                label="Enregistrer l’établissement"
                icon="check"
                compact
                onPress={handleSaveSchool}
              />
              <Button
                label="Fermer"
                secondary
                compact
                onPress={() => setEditingSchool(false)}
              />
            </View>
          </View>
        )}
      </Surface>

      <SectionTitle title="Palette de couleurs" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le choix des palettes de couleurs"
        onPress={() => router.push('/settings/theme')}
        style={({ pressed }) => [
          styles.settingRow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 18,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
          <Feather name="droplet" size={18} color={colors.primary} />
        </View>
        <View style={styles.settingCopy}>
          <Text style={[styles.value, { color: colors.foreground }]}>
            Choisir une palette
          </Text>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>
            Changez les couleurs de l’application.
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <SectionTitle title="Configuration pédagogique" />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/settings/pedagogical')}
        style={({ pressed }) => [
          styles.settingRow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 18,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
          <Feather name="book-open" size={18} color={colors.primary} />
        </View>
        <View style={styles.settingCopy}>
          <Text style={[styles.value, { color: colors.foreground }]}>
            Années, niveaux et compétences
          </Text>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>
            Configurez les niveaux, compétences et objectifs par année scolaire.
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      {/* BACKUP & SECURITY */}
      <SectionTitle title="Sauvegarde & sécurité" />
      <Surface style={styles.card}>
        <View style={styles.settingRowInner}>
          <View style={[styles.settingIcon, { backgroundColor: colors.successSurface }]}><Feather name="check-circle" size={18} color={colors.successForeground} /></View>
          <View style={styles.settingCopy}>
            <Text style={[styles.value, { color: colors.foreground }]}>Sauvegarde automatique quotidienne</Text>
            <Text style={[styles.help, { color: colors.mutedForeground }]}>{data.lastBackupAt ? `Dernière sauvegarde : ${new Date(data.lastBackupAt).toLocaleString('fr-FR')}` : 'Une sauvegarde sera créée automatiquement après le premier démarrage.'}</Text>
          </View>
        </View>
        <View style={styles.settingRowInner}>
          <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="archive" size={18} color={colors.primary} /></View>
          <View style={styles.settingCopy}>
            <Text style={[styles.value, { color: colors.foreground }]}>Sauvegarde complète</Text>
            <Text style={[styles.help, { color: colors.mutedForeground }]}>Enregistrez toutes les données de l’application — établissement, années scolaires, classes, élèves, évaluations, objectifs, résultats et remédiations — dans un fichier JSON sur votre appareil ou dans un autre emplacement.</Text>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <Button label="Créer une sauvegarde" compact icon="download" onPress={() => { void handleCreateBackup(); }} />
          <Button label="Restaurer" compact secondary icon="upload" onPress={() => { void handleRestoreBackup(); }} />
        </View>
        <View style={[styles.settingRowInner, { marginTop: 8 }]}>
          <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="lock" size={18} color={colors.primary} /></View>
          <View style={styles.settingCopy}>
            <Text style={[styles.value, { color: colors.foreground }]}>Code PIN et biométrie</Text>
            <Text style={[styles.help, { color: colors.mutedForeground }]}>{security.hasPin ? (security.biometricEnabled ? 'Activés : code PIN et visage / empreinte.' : 'Activé : un code PIN est demandé à l’ouverture et au retour dans l’application.') : 'Protégez l’accès à vos données avec un code PIN, puis ajoutez le visage ou l’empreinte.'}</Text>
          </View>
          <Text style={[styles.enabled, { color: security.hasPin ? colors.successForeground : colors.mutedForeground }]}>{security.hasPin ? 'Activé' : 'Désactivé'}</Text>
        </View>
        {!security.hasPin && !editingPin ? <Button label="Activer le code PIN" compact onPress={() => { setPinInput(''); setPinConfirmation(''); setPinError(''); setConfirmingPin(false); setEditingPin(true); }} icon="lock" /> : null}
        {security.hasPin ? <Button label="Créer / remplacer le code de récupération" compact secondary onPress={() => { setRecoveryPinInput(''); setRecoveryPinError(''); setCreatingRecoveryCode(true); }} icon="key" /> : null}
        {security.hasPin ? <Button label="Désactiver le code PIN" compact secondary onPress={handleRemovePin} icon="unlock" /> : null}
        {security.hasPin && security.biometricAvailable ? <Button label={security.biometricEnabled ? 'Désactiver visage / empreinte' : 'Activer visage / empreinte'} compact secondary onPress={() => { void handleToggleBiometric(); }} icon={security.biometricEnabled ? 'shield-off' : 'shield'} /> : null}
        {security.hasPin && !security.biometricAvailable ? <Text style={[styles.help, { color: colors.mutedForeground }]}>La biométrie sera disponible après l’enregistrement d’un visage ou d’une empreinte dans les réglages de l’appareil.</Text> : null}
      </Surface>
      <Modal visible={editingPin} animationType="fade" onRequestClose={closePinSetup}>
        <PinEntryScreen
          title={confirmingPin ? 'Confirmez votre code PIN' : 'Créez votre code PIN'}
          subtitle={confirmingPin ? 'Saisissez à nouveau les 4 chiffres pour confirmer' : 'Choisissez un code à 4 chiffres pour protéger vos données'}
          pin={confirmingPin ? pinConfirmation : pinInput}
          error={pinError}
          hint={confirmingPin ? 'Confirmation du code' : 'Nouveau code de 4 chiffres'}
          onDigit={handlePinDigit}
          onBackspace={handlePinBackspace}
          footer={
            <Pressable
              onPress={closePinSetup}
              style={({ pressed }) => [styles.cancelPinButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelPinText, { color: colors.mutedForeground }]}>Annuler</Text>
            </Pressable>
          }
        />
      </Modal>
      <RecoveryCodeDialog code={recoveryCode} onDone={() => setRecoveryCode('')} />
      <Modal
        visible={creatingRecoveryCode}
        animationType="fade"
        onRequestClose={() => { setCreatingRecoveryCode(false); setRecoveryPinInput(''); setRecoveryPinError(''); }}
      >
        <PinEntryScreen
          title="Confirmez votre identité"
          subtitle="Saisissez le PIN actuel pour générer un nouveau code de récupération"
          pin={recoveryPinInput}
          error={recoveryPinError}
          hint="Votre ancien code de récupération sera remplacé"
          onDigit={handleRecoveryPinDigit}
          onBackspace={() => { setRecoveryPinInput((value) => value.slice(0, -1)); setRecoveryPinError(''); }}
          footer={
            <Pressable
              onPress={() => { setCreatingRecoveryCode(false); setRecoveryPinInput(''); setRecoveryPinError(''); }}
              style={({ pressed }) => [styles.cancelPinButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelPinText, { color: colors.mutedForeground }]}>Annuler</Text>
            </Pressable>
          }
        />
      </Modal>
      {/* DANGER ZONE / RESET */}
      <SectionTitle title="Gestion des données" />
      <Surface style={[styles.card, { marginBottom: 16 }]}>
        <View style={styles.settingRowInner}>
          <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
            <Feather name="database" size={18} color={colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={[styles.value, { color: colors.foreground }]}>Données de démonstration</Text>
            <Text style={[styles.help, { color: colors.mutedForeground }]}>
              Remplacez les données pédagogiques par 5 classes de 32 à 40 élèves et un emploi du temps de 14 heures par semaine.
            </Text>
          </View>
        </View>
        <Button
          label={generatingTestData ? 'Génération en cours…' : 'Générer les données de test'}
          compact
          icon="database"
          disabled={generatingTestData}
          onPress={confirmGenerateTestData}
        />
      </Surface>
      <Surface style={[styles.card, { borderColor: colors.errorSurface }]}>
        <View style={styles.dangerHeader}>
          <Feather
            name="alert-triangle"
            size={20}
            color={colors.errorForeground}
          />
          <Text style={[styles.dangerTitle, { color: colors.errorForeground }]}>
            Réinitialiser l'application
          </Text>
        </View>
        <Text style={[styles.help, { color: colors.mutedForeground }]}>
          Vider l'ensemble des données enregistrées (classes, compétences,
          évaluations et élèves) pour repartir d'une base vierge.
        </Text>
        {resetActionArmed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir la confirmation de réinitialisation"
            onTouchStart={(event) => event.stopPropagation()}
            onPress={() => {
              setResetActionArmed(false);
              setResetStage('confirm');
              setResetConfirmation('');
              setResetError('');
              setResetModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.dangerButton,
              { backgroundColor: colors.card, borderColor: colors.destructive, borderWidth: 2, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="trash-2" size={16} color={colors.errorForeground} />
            <Text style={[styles.dangerButtonText, { color: colors.errorForeground }]}>Vider toute la base de données</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Maintenez appuyé pour afficher l’action de réinitialisation."
            onLongPress={() => setResetActionArmed(true)}
            style={({ pressed }) => [
              styles.dangerButton,
              { backgroundColor: colors.errorSurface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="trash-2" size={16} color={colors.errorForeground} />
            <Text style={[styles.dangerButtonText, { color: colors.errorForeground }]}>Maintenir pour réinitialiser</Text>
          </Pressable>
        )}
      </Surface>
      <Modal
        visible={resetModalVisible}
        animationType="fade"
        onRequestClose={closeResetModal}
      >
        <KeyboardAvoidingViewCompat style={{ flex: 1 }}>
        {resetStage === 'pin' ? (
          <PinEntryScreen
            title="Confirmez votre identité"
            subtitle="Saisissez le code PIN de l’application pour continuer"
            pin={resetPin}
            error={resetPinError}
            hint="Vérification requise avant l’effacement"
            onDigit={handleResetPinDigit}
            onBackspace={() => {
              setResetPin((current) => current.slice(0, -1));
              setResetPinError('');
            }}
            footer={
              <Pressable
                onPress={closeResetModal}
                style={({ pressed }) => [styles.cancelPinButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
                accessibilityRole="button"
              >
                <Text style={[styles.cancelPinText, { color: colors.mutedForeground }]}>Annuler</Text>
              </Pressable>
            }
          >
            {security.biometricEnabled && security.biometricAvailable ? (
              <Pressable
                onPress={() => { void authorizeResetWithBiometrics(); }}
                style={({ pressed }) => [styles.biometricResetButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
              >
                <Feather name="shield" size={16} color={colors.primary} />
                <Text style={[styles.biometricResetText, { color: colors.primary }]}>Utiliser visage / empreinte</Text>
              </Pressable>
            ) : null}
          </PinEntryScreen>
        ) : (
          <View style={[styles.resetModal, { backgroundColor: colors.background }]}>
            <View style={[styles.resetPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.resetIcon, { backgroundColor: colors.errorSurface }]}>
                <Feather name="alert-triangle" size={24} color={colors.errorForeground} />
              </View>
              <Text style={[styles.resetTitle, { color: colors.foreground }]}>
                {resetStage === 'confirm' ? 'Réinitialiser l’application ?' : 'Dernière confirmation'}
              </Text>
              {resetStage === 'confirm' ? (
                <>
                  <Text style={[styles.resetDescription, { color: colors.mutedForeground }]}>
                    Cette action effacera définitivement les données locales suivantes :
                  </Text>
                  <View style={[styles.resetCounts, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.resetCountText, { color: colors.foreground }]}>{data.classes.length} classes</Text>
                    <Text style={[styles.resetCountText, { color: colors.foreground }]}>{data.pupils.length} élèves</Text>
                    <Text style={[styles.resetCountText, { color: colors.foreground }]}>{data.assessments.length} évaluations</Text>
                  </View>
                  <Text style={[styles.resetDescription, { color: colors.mutedForeground }]}>
                    Vous pouvez d’abord créer une sauvegarde complète. Cette étape est facultative.
                  </Text>
                  <Button label="Créer une sauvegarde" compact secondary icon="download" onPress={() => { void handleCreateBackup(); }} />
                  <View style={styles.buttonRow}>
                    <Button label="Annuler" compact secondary onPress={closeResetModal} />
                    <Button label="Continuer" compact icon="arrow-right" onPress={beginResetConfirmation} />
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.resetDescription, { color: colors.mutedForeground }]}>
                    {security.hasPin
                      ? 'Identité vérifiée. Pour effacer les données, saisissez EFFACER ci-dessous.'
                      : 'Pour éviter un effacement accidentel, saisissez EFFACER ci-dessous.'}
                  </Text>
                  <TextInput
                    value={resetConfirmation}
                    onChangeText={(value) => {
                      setResetConfirmation(value.toUpperCase());
                      setResetError('');
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="EFFACER"
                    placeholderTextColor={colors.mutedForeground}
                    accessibilityLabel="Saisissez EFFACER pour confirmer la réinitialisation"
                    style={[styles.resetInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                  {resetError ? <Text style={[styles.resetError, { color: colors.errorForeground }]}>{resetError}</Text> : null}
                  <View style={styles.buttonRow}>
                    <Button label="Annuler" compact secondary onPress={closeResetModal} disabled={resetting} />
                    <Pressable
                      onPress={() => { void handleResetData(); }}
                      disabled={resetConfirmation !== 'EFFACER' || resetting}
                      style={({ pressed }) => [
                        styles.resetConfirmButton,
                        {
                          backgroundColor: colors.errorForeground,
                          opacity: resetConfirmation !== 'EFFACER' || resetting ? 0.45 : pressed ? 0.75 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.resetConfirmText, { color: colors.primaryForeground }]}>
                        {resetting ? 'Réinitialisation…' : 'Tout effacer'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
        </KeyboardAvoidingViewCompat>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, padding: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1, gap: 2 },
  formRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  label: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: '800',
    marginBottom: 2,
  },
  value: { fontSize: 15, fontWeight: '700' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 16,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: { flex: 1, gap: 4 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  reminderCopy: { flex: 1, minWidth: 0, gap: 4 },
  reminderTiming: { gap: 9, paddingTop: 14, borderTopWidth: 1 },
  reminderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderOption: { minHeight: 36, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  reminderStatus: { minHeight: 34, borderTopWidth: 1, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  reminderStatusText: { flex: 1 },
  reminderNext: { borderWidth: 1, borderRadius: 10, padding: 11, gap: 5 },
  settingRowInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  help: { fontSize: 12, lineHeight: 18 },
  enabled: { fontSize: 12, fontWeight: '800' },
  editBox: { paddingTop: 14, marginTop: 4, borderTopWidth: 1, gap: 10 },
  inputGroup: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelPinButton: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, marginTop: 16 },
  cancelPinText: { fontSize: 13, fontWeight: '700' },
  biometricResetButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginTop: 14 },
  biometricResetText: { fontSize: 13, fontWeight: '700' },
  resetModal: { flex: 1, justifyContent: 'center', padding: 20 },
  resetPanel: { width: '100%', maxWidth: 460, alignSelf: 'center', borderWidth: 1, borderRadius: 22, padding: 22, gap: 14 },
  resetIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resetTitle: { fontSize: 21, fontWeight: '800' },
  resetDescription: { fontSize: 14, lineHeight: 21 },
  resetCounts: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 14 },
  resetCountText: { fontSize: 12, fontWeight: '700' },
  resetInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  resetError: { fontSize: 13, fontWeight: '700' },
  resetConfirmButton: { minHeight: 38, borderRadius: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  resetConfirmText: { fontSize: 13, fontWeight: '800' },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dangerTitle: { fontSize: 15, fontWeight: '800' },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  dangerButtonText: { fontSize: 14, fontWeight: '700' },
});
