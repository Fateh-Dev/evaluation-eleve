import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

function nextAcademicYear(year: string): string {
  const match = year.match(/^(\d{4})\s*[-/]\s*(\d{4})$/);
  if (!match) return '';
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
}

export default function YearEndScreen() {
  const colors = useColors();
  const data = useAppData();
  const [sourceYear, setSourceYear] = useState(data.academicYear);
  const [targetYear, setTargetYear] = useState(() => nextAcademicYear(data.academicYear));
  const [copyPedagogicalConfiguration, setCopyPedagogicalConfiguration] = useState(true);
  const [carryClassesAndPupils, setCarryClassesAndPupils] = useState(true);
  const [copySchedule, setCopySchedule] = useState(false);
  const [working, setWorking] = useState(false);

  const sourceClasses = useMemo(
    () => data.classes.filter((item) => item.academicYear === sourceYear),
    [data.classes, sourceYear],
  );
  const sourceClassIds = new Set(sourceClasses.map((item) => item.id));
  const classCount = carryClassesAndPupils ? sourceClasses.length : 0;
  const pupilCount = carryClassesAndPupils
    ? data.pupils.filter((pupil) => sourceClassIds.has(pupil.classId)).length
    : 0;
  const sessionCount = copySchedule
    ? data.scheduleSessions.filter((session) => sourceClassIds.has(session.classId)).length
    : 0;
  const archived = new Set(data.archivedAcademicYears);

  const runArchive = async () => {
    if (working) return;
    setWorking(true);
    try {
      const result = await data.archiveAndCreateAcademicYear(
        sourceYear,
        targetYear,
        {
          copyPedagogicalConfiguration,
          carryClassesAndPupils,
          copySchedule,
        },
      );
      if (!result.ok) {
        const message = {
          'source-not-found': 'L’année à archiver n’existe plus.',
          'already-archived': 'Cette année est déjà archivée.',
          'target-invalid': 'Saisissez une nouvelle année scolaire différente de l’année à archiver.',
          'target-exists': 'Cette année scolaire existe déjà. Choisissez un autre libellé.',
        }[result.reason];
        Alert.alert('Création impossible', message);
        return;
      }
      Alert.alert(
        'Année archivée',
        `${sourceYear} est conservée comme historique. ${targetYear} est créée avec ${result.classCount} classe(s), ${result.pupilCount} élève(s) et ${result.sessionCount} séance(s) copiés. Les évaluations, notes et présences ne sont jamais reportées.`,
        [{ text: 'Continuer', onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert(
        'Archivage impossible',
        error instanceof Error ? error.message : 'L’année scolaire n’a pas pu être préparée.',
      );
    } finally {
      setWorking(false);
    }
  };

  const confirmArchive = () => {
    if (archived.has(sourceYear)) {
      Alert.alert('Année déjà archivée', 'Cette année est déjà marquée comme archivée.');
      return;
    }
    Alert.alert(
      'Archiver et créer une année ?',
      `${sourceYear} restera intacte pour consultation. La nouvelle année ${targetYear.trim() || 'à définir'} sera activée. Seules les options cochées seront reprises; les résultats, présences et historiques ne seront pas copiés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver et continuer',
          onPress: () => { void runArchive(); },
        },
      ],
    );
  };

  return (
    <Screen>
      <AppHeader eyebrow="Organisation · Historique" title="Fin d’année scolaire" onBack={() => router.back()} />
      <Surface style={styles.intro}>
        <Feather name="archive" size={19} color={colors.primary} />
        <Text style={[styles.body, { color: colors.foreground }]}>
          Conservez l’année terminée et ses résultats, puis créez l’année suivante sans mélanger les données.
        </Text>
      </Surface>

      <SectionTitle title="Année à archiver" />
      <View style={styles.choices}>
        {data.schoolYearConfigurations.map((configuration) => {
          const selected = sourceYear === configuration.year;
          const isArchived = archived.has(configuration.year);
          return (
            <Pressable
              key={configuration.year}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setSourceYear(configuration.year);
                if (!targetYear || targetYear === nextAcademicYear(sourceYear)) {
                  setTargetYear(nextAcademicYear(configuration.year));
                }
              }}
              style={[styles.yearChip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
            >
              <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontWeight: '700' }}>
                {configuration.year}{isArchived ? ' · Archivée' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {archived.has(sourceYear) ? (
        <View style={styles.restoreAction}>
          <Button
            label={`Restaurer ${sourceYear} comme année active`}
            icon="rotate-ccw"
            secondary
            compact
            onPress={() => {
              data.setAcademicYearArchived(sourceYear, false);
              Alert.alert('Année restaurée', `${sourceYear} est de nouveau marquée comme année active.`);
            }}
          />
        </View>
      ) : null}

      <SectionTitle title="Nouvelle année scolaire" />
      <TextInput
        value={targetYear}
        onChangeText={setTargetYear}
        placeholder="Ex. 2027-2028"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
      />

      <SectionTitle title="Choisir les éléments à reprendre" />
      <View style={styles.options}>
        <OptionRow
          title="Configuration pédagogique"
          description="Niveaux, compétences et objectifs. Désactivé, la nouvelle année reçoit la configuration par défaut."
          value={copyPedagogicalConfiguration}
          onChange={setCopyPedagogicalConfiguration}
        />
        <OptionRow
          title={`Classes et élèves (${classCount} classe(s), ${pupilCount} élève(s))`}
          description="Crée de nouvelles classes et de nouveaux identifiants d’élèves. Les classes sources et leurs données restent intactes."
          value={carryClassesAndPupils}
          onChange={(value) => {
            setCarryClassesAndPupils(value);
            if (!value) setCopySchedule(false);
          }}
        />
        <OptionRow
          title={`Emploi du temps (${sessionCount} séance(s))`}
          description="Copie les séances récurrentes sur les nouvelles classes. Les annulations et reports ponctuels ne sont pas repris."
          value={copySchedule}
          disabled={!carryClassesAndPupils}
          onChange={setCopySchedule}
        />
      </View>

      <Surface style={[styles.notice, { marginTop: 14 }]}>
        <Feather name="info" size={17} color={colors.primary} />
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Les évaluations, tests de niveau, notes, présences, événements disciplinaires et décisions de remédiation restent uniquement dans l’année archivée. Ils ne sont jamais copiés. Une sauvegarde automatique est tentée avant la création.
        </Text>
      </Surface>
      <View style={styles.archiveAction}>
        <Button
          label={working ? 'Préparation en cours…' : 'Archiver et créer la nouvelle année'}
          icon="archive"
          disabled={working || archived.has(sourceYear)}
          onPress={confirmArchive}
        />
      </View>
    </Screen>
  );
}

function OptionRow({
  title,
  description,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Surface style={[styles.option, disabled && styles.disabled]}>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  body: { flex: 1, fontSize: 12, lineHeight: 18 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  restoreAction: { marginTop: 12 },
  yearChip: { minHeight: 38, borderWidth: 1, borderRadius: 18, justifyContent: 'center', paddingHorizontal: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 },
  options: { gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { fontSize: 13, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  archiveAction: { marginTop: 12 },
  disabled: { opacity: 0.5 },
});
