import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Screen, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { DEFAULT_SCHOOL_LEVELS } from '@/services/pedagogicalConfiguration';
import { useColors } from '@/hooks/useColors';

const STEP_TITLES = [
  'Parlons de vous',
  'Votre année scolaire',
  'Votre première classe',
];

export default function OnboardingScreen() {
  const colors = useColors();
  const data = useAppData();
  const [step, setStep] = useState(0);
  const [teacherName, setTeacherName] = useState(data.teacherName);
  const [schoolName, setSchoolName] = useState(data.school.name);
  const [wilaya, setWilaya] = useState(data.school.wilaya);
  const [academicYear, setAcademicYear] = useState(data.academicYear);
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState(DEFAULT_SCHOOL_LEVELS[0]);

  const levels = useMemo(() => {
    const configuredLevels = data.getSchoolYearConfiguration(academicYear)?.levels.map(
      (item) => item.name,
    ) ?? [];
    return [...new Set([...DEFAULT_SCHOOL_LEVELS, ...configuredLevels])];
  }, [academicYear, data.schoolYearConfigurations]);

  const goForward = () => {
    if (step === 0 && (!teacherName.trim() || !schoolName.trim())) {
      Alert.alert('Informations requises', 'Saisissez votre nom et celui de votre établissement.');
      return;
    }
    if (step === 1 && !academicYear.trim()) {
      Alert.alert('Année scolaire requise', 'Saisissez l’année scolaire à configurer.');
      return;
    }
    if (step < STEP_TITLES.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    if (!className.trim() || !level) {
      Alert.alert('Classe requise', 'Saisissez le nom de votre classe et sélectionnez son niveau.');
      return;
    }

    data.updateTeacherName(teacherName.trim());
    data.updateSchool({
      name: schoolName.trim(),
      wilaya: wilaya.trim(),
      academicYear: academicYear.trim(),
    });
    data.setActiveAcademicYear(academicYear.trim());
    data.createClass({
      name: className.trim(),
      level,
      academicYear: academicYear.trim(),
    });
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <AppHeader eyebrow="Configuration" title="Premiers réglages" compact />
      <View style={styles.header}>
        <View style={[styles.brandIcon, { backgroundColor: colors.accent }]}>
          <Feather name="compass" size={23} color={colors.primary} />
        </View>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>GUIDE DE PARAMÉTRAGE</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Bienvenue !</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Quelques réponses suffisent pour préparer votre espace de suivi.
        </Text>
      </View>

      <View style={styles.progressRow} accessibilityLabel={`Étape ${step + 1} sur ${STEP_TITLES.length}`}>
        {STEP_TITLES.map((title, index) => (
          <View
            key={title}
            style={[
              styles.progressSegment,
              { backgroundColor: index <= step ? colors.primary : colors.muted },
            ]}
          />
        ))}
      </View>

      <Surface
        style={styles.formCard}
        guideTitle="Paramétrage initial"
        guideDescription="Répondez à chaque question pour préparer les informations de votre espace enseignant."
      >
        <Text style={[styles.stepCount, { color: colors.mutedForeground }]}>
          ÉTAPE {step + 1} SUR {STEP_TITLES.length}
        </Text>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>{STEP_TITLES[step]}</Text>

        {step === 0 ? (
          <>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>VOTRE NOM</Text>
              <TextInput
                autoCapitalize="words"
                autoComplete="name"
                placeholder="Ex. Samira Benali"
                placeholderTextColor={colors.mutedForeground}
                value={teacherName}
                onChangeText={setTeacherName}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>ÉTABLISSEMENT</Text>
              <TextInput
                autoCapitalize="words"
                placeholder="Nom de votre établissement"
                placeholderTextColor={colors.mutedForeground}
                value={schoolName}
                onChangeText={setSchoolName}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>WILAYA (FACULTATIF)</Text>
              <TextInput
                autoCapitalize="words"
                placeholder="Votre wilaya"
                placeholderTextColor={colors.mutedForeground}
                value={wilaya}
                onChangeText={setWilaya}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
          </>
        ) : step === 1 ? (
          <>
            <Text style={[styles.help, { color: colors.mutedForeground }]}>
              Cette année sera associée à vos classes et à leur configuration pédagogique.
            </Text>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>ANNÉE SCOLAIRE</Text>
              <TextInput
                autoCapitalize="none"
                placeholder="2026-2027"
                placeholderTextColor={colors.mutedForeground}
                value={academicYear}
                onChangeText={(value) => {
                  setAcademicYear(value);
                  const availableLevels = data.getSchoolYearConfiguration(value)?.levels;
                  if (availableLevels?.length && !availableLevels.some((item) => item.name === level)) {
                    setLevel(availableLevels[0].name);
                  }
                }}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>NOM DE LA CLASSE</Text>
              <TextInput
                autoCapitalize="words"
                placeholder="Ex. 2AS LPH"
                placeholderTextColor={colors.mutedForeground}
                value={className}
                onChangeText={setClassName}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>NIVEAU</Text>
              <View style={styles.levelChoices}>
                {levels.map((item) => {
                  const selected = level === item;
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setLevel(item)}
                      style={[
                        styles.levelChoice,
                        {
                          backgroundColor: selected ? colors.primary : colors.secondary,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.levelText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={[styles.summary, { backgroundColor: colors.muted }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.foreground }]}>
                Votre espace sera prêt avec {schoolName.trim()} · {academicYear.trim()} · {className.trim() || 'votre classe'} ({level}).
              </Text>
            </View>
          </>
        )}

        <View style={styles.actions}>
          {step > 0 && (
            <Button label="Précédent" icon="arrow-left" compact secondary onPress={() => setStep((current) => current - 1)} />
          )}
          <View style={styles.nextButton}>
            <Button
              label={step === STEP_TITLES.length - 1 ? 'Créer mon espace' : 'Continuer'}
              icon={step === STEP_TITLES.length - 1 ? 'check' : 'arrow-right'}
              onPress={goForward}
            />
          </View>
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 22 },
  brandIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center' },
  subtitle: { maxWidth: 310, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  progressRow: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  formCard: { gap: 14, padding: 18 },
  stepCount: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  stepTitle: { fontSize: 20, fontWeight: '800', marginBottom: 3 },
  field: { gap: 7 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  help: { fontSize: 13, lineHeight: 19 },
  levelChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChoice: { minHeight: 40, minWidth: 62, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 11, paddingHorizontal: 13 },
  levelText: { fontSize: 13, fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 11 },
  summaryText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 5 },
  nextButton: { flex: 1 },
});
