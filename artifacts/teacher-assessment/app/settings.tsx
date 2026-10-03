import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AppHeader,
  Button,
  Screen,
  SectionTitle,
  Surface,
} from '@/components/AppShell';
import PedagogicalConfigurationManager from '@/components/PedagogicalConfigurationManager';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const data = useAppData();

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

  const handleResetData = () => {
    Alert.alert(
      'Vider la base de données',
      'Attention : cette action va effacer TOUTES vos classes, élèves, évaluations et notes enregistrées. L’application repartira de zéro.\n\nÊtes-vous sûr de vouloir continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: () => {
            data.resetAllData();
            Alert.alert(
              'Base réinitialisée',
              'Toutes les données ont été effacées.',
            );
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <AppHeader
        eyebrow="Configuration & Profil"
        title="Paramètres"
        onBack={() => router.back()}
      />

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

      <PedagogicalConfigurationManager />

      {/* DOCUMENTS SPEC */}
      <SectionTitle title="Documents & Modèles" />
      <Surface style={styles.settingRow}>
        <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
          <Feather name="file-text" size={18} color={colors.primary} />
        </View>
        <View style={styles.settingCopy}>
          <Text style={[styles.value, { color: colors.foreground }]}>
            Format officiel de référence
          </Text>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>
            Grille officielle d’évaluation · Algérie
          </Text>
        </View>
        <Text style={[styles.enabled, { color: colors.successForeground }]}>
          Actif
        </Text>
      </Surface>

      {/* SYNCHRONIZATION */}
      <SectionTitle title="Stockage & Synchronisation" />
      <Surface style={styles.card}>
        <Text style={[styles.value, { color: colors.foreground }]}>
          Stockage local 100% hors-ligne
        </Text>
        <Text style={[styles.help, { color: colors.mutedForeground }]}>
          Toutes les classes, élèves et évaluations sont stockés en sécurité sur
          cet appareil et restent accessibles à tout moment.
        </Text>
        <Button
          label="Marquer comme synchronisé"
          compact
          secondary
          onPress={data.markSynced}
          icon="refresh-cw"
        />
      </Surface>

      {/* DANGER ZONE / RESET */}
      <SectionTitle title="Gestion des données" />
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
        <Pressable
          onPress={handleResetData}
          style={({ pressed }) => [
            styles.dangerButton,
            {
              backgroundColor: colors.errorSurface,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="trash-2" size={16} color={colors.errorForeground} />
          <Text
            style={[styles.dangerButtonText, { color: colors.errorForeground }]}
          >
            Vider toute la base de données
          </Text>
        </Pressable>
      </Surface>
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
