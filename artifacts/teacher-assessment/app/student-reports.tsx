import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { exportStudentProgressReportPdf } from '@/services/exportService';
import { buildStudentProgressReport } from '@/services/studentProgressReport';

export default function StudentReportsScreen() {
  const colors = useColors();
  const data = useAppData();
  const [classId, setClassId] = useState(data.activeClassId || data.classes[0]?.id || '');
  const currentClass = data.classes.find((item) => item.id === classId);
  const periods = currentClass
    ? data.getContinuousEvaluationPeriods(currentClass.academicYear)
    : [];
  const [periodId, setPeriodId] = useState('');
  const [pupilId, setPupilId] = useState('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!periods.some((period) => period.id === periodId)) {
      setPeriodId(
        data.getActiveContinuousEvaluationPeriod(currentClass?.academicYear ?? '')?.id ??
          periods[0]?.id ??
          '',
      );
    }
    setPupilId('all');
  }, [classId, currentClass?.academicYear, data.continuousEvaluationPeriods]);

  const period = periods.find((item) => item.id === periodId);
  const pupils = data.pupils.filter((pupil) => pupil.classId === classId);
  const report = useMemo(() => {
    if (!currentClass || !period) return null;
    const classAssessments = data.assessments.filter(
      (assessment) => assessment.classId === currentClass.id,
    );
    return buildStudentProgressReport({
      school: data.school,
      teacherName: data.teacherName,
      classItem: currentClass,
      period,
      pupils,
      assessments: classAssessments.map((assessment) => ({
        id: assessment.id,
        title: assessment.title,
        competency: assessment.competency,
        date: assessment.date,
        objectives: data.allObjectives[assessment.id] ?? [],
        evaluations: data.allEvaluations[assessment.id] ?? {},
        absentPupilIds: data.absentPupilIds[assessment.id] ?? [],
      })),
      continuousEvaluations: data.continuousEvaluations,
      attendanceRecords: data.attendanceRecords,
      disciplineEvents: data.disciplineEvents,
      absencePenaltyPerAbsence:
        data.continuousEvaluationSettings.absencePenaltyPerAbsence,
    });
  }, [
    currentClass,
    period,
    pupils,
    data.school,
    data.teacherName,
    data.assessments,
    data.allObjectives,
    data.allEvaluations,
    data.absentPupilIds,
    data.continuousEvaluations,
    data.attendanceRecords,
    data.disciplineEvents,
    data.continuousEvaluationSettings,
  ]);

  const selectedReports = report
    ? pupilId === 'all'
      ? report.pupils
      : report.pupils.filter((pupil) => pupil.id === pupilId)
    : [];
  const exportReport = async () => {
    if (!report || !period || selectedReports.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportStudentProgressReportPdf({
        ...report,
        pupils: selectedReports,
      });
    } catch (error) {
      Alert.alert(
        'Export impossible',
        error instanceof Error ? error.message : 'Le bulletin PDF n’a pas pu être généré.',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <AppHeader eyebrow="Analyse · Impression" title="Bilans trimestriels" />
      <Text style={[styles.help, { color: colors.mutedForeground }]}>
        Consultez les résultats, l’évaluation continue et les présences d’un élève ou de toute la classe sur un trimestre.
      </Text>
      <SectionTitle title="Classe" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {data.classes.map((item) => {
          const selected = item.id === classId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setClassId(item.id)}
              style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
            >
              <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontWeight: '700' }}>{item.name} · {item.academicYear}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionTitle title="Trimestre" />
      {periods.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {periods.map((item) => {
            const selected = item.id === periodId;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setPeriodId(item.id)}
                style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
              >
                <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontWeight: '700' }}>{item.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Surface style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucun trimestre configuré pour cette année. Ajoutez une période depuis Suivi.</Text>
        </Surface>
      )}

      {period ? (
        <>
          <Text style={[styles.periodCaption, { color: colors.mutedForeground }]}>{period.startDate} – {period.endDate}</Text>
          <SectionTitle title="Élève ou classe entière" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: pupilId === 'all' }}
              onPress={() => setPupilId('all')}
              style={[styles.chip, { backgroundColor: pupilId === 'all' ? colors.primary : colors.card, borderColor: pupilId === 'all' ? colors.primary : colors.border }]}
            >
              <Text style={{ color: pupilId === 'all' ? colors.primaryForeground : colors.foreground, fontWeight: '700' }}>Toute la classe ({pupils.length})</Text>
            </Pressable>
            {pupils.map((pupil) => {
              const selected = pupilId === pupil.id;
              return (
                <Pressable
                  key={pupil.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPupilId(pupil.id)}
                  style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontWeight: '700' }}>{pupil.lastName} {pupil.firstName}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {selectedReports.length ? (
            <View style={styles.pupilList}>
              {selectedReports.map((pupil) => (
                <Surface key={pupil.id} style={styles.pupilCard}>
                  <View style={styles.pupilHeading}>
                    <View style={[styles.pupilIcon, { backgroundColor: colors.accent }]}>
                      <Feather name="user" size={17} color={colors.primary} />
                    </View>
                    <View style={styles.pupilCopy}>
                      <Text style={[styles.pupilName, { color: colors.foreground }]}>{pupil.lastName} {pupil.firstName}</Text>
                      <Text style={[styles.help, { color: colors.mutedForeground }]}>Matricule {pupil.registrationNumber}</Text>
                    </View>
                    <Text style={[styles.average, { color: colors.primary }]}>
                      {pupil.averageAssessmentPercent === null ? '—' : `${pupil.averageAssessmentPercent}%`}
                    </Text>
                  </View>
                  <Text style={[styles.summary, { color: colors.mutedForeground }]}>
                    {pupil.assessments.length} évaluation{pupil.assessments.length === 1 ? '' : 's'} · Cahier {pupil.cahierScore ?? '—'}/5 · Participation {pupil.participationScore ?? '—'}/5 · Présences {pupil.presentSessions} · Absences {pupil.absentSessions}
                  </Text>
                  <Text style={[styles.summary, { color: colors.mutedForeground }]}>
                    Absence {pupil.absenceScore}/5 · Discipline {pupil.disciplineScore}/5 · Total continu {pupil.continuousTotal === null ? 'à compléter' : `${pupil.continuousTotal}/20`}
                  </Text>
                </Surface>
              ))}
            </View>
          ) : null}
          {!pupils.length ? (
            <Surface style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Cette classe ne contient aucun élève.</Text>
            </Surface>
          ) : (
            <View style={styles.exportAction}>
              <Button
                label={exporting ? 'Préparation du PDF…' : pupilId === 'all' ? 'Imprimer les bilans de la classe' : 'Imprimer le bilan de l’élève'}
                icon="printer"
                disabled={exporting}
                onPress={() => { void exportReport(); }}
              />
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip: { minHeight: 38, borderWidth: 1, borderRadius: 18, justifyContent: 'center', paddingHorizontal: 13 },
  periodCaption: { fontSize: 11, marginTop: 5 },
  empty: { padding: 14 },
  emptyText: { fontSize: 12, lineHeight: 18 },
  pupilList: { gap: 12, marginTop: 12 },
  pupilCard: { gap: 9 },
  pupilHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pupilIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pupilCopy: { flex: 1, gap: 2 },
  pupilName: { fontSize: 14, fontWeight: '700' },
  average: { fontSize: 18, fontWeight: '800' },
  summary: { fontSize: 11, lineHeight: 17 },
  exportAction: { marginTop: 12 },
});
