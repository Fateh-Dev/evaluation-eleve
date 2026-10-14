import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { generateStudentProgressReportPdfHtml } from '@/services/exportService';
import { buildStudentProgressReport } from '@/services/studentProgressReport';

type PickerType = 'class' | 'period' | 'pupil';
type PickerOption = { id: string; label: string; detail?: string };

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
  const [pickerType, setPickerType] = useState<PickerType | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);

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
  const previewHtml = useMemo(
    () => report && selectedReports.length
      ? generateStudentProgressReportPdfHtml({ ...report, pupils: selectedReports })
      : '',
    [report, pupilId],
  );
  const pickerOptions: PickerOption[] = pickerType === 'class'
    ? data.classes.map((item) => ({
        id: item.id,
        label: item.name,
        detail: `${item.level} · ${item.academicYear}`,
      }))
    : pickerType === 'period'
      ? periods.map((item) => ({
          id: item.id,
          label: item.name,
          detail: `${item.startDate} – ${item.endDate}`,
        }))
      : pickerType === 'pupil'
        ? [
            {
              id: 'all',
              label: 'Toute la classe',
              detail: `${pupils.length} élève${pupils.length === 1 ? '' : 's'} · un bilan par élève`,
            },
            ...pupils.map((pupil) => ({
              id: pupil.id,
              label: `${pupil.lastName} ${pupil.firstName}`,
              detail: `Matricule ${pupil.registrationNumber}`,
            })),
          ]
        : [];
  const filteredPickerOptions = pickerOptions.filter((option) =>
    `${option.label} ${option.detail ?? ''}`
      .toLocaleLowerCase('fr')
      .includes(pickerQuery.trim().toLocaleLowerCase('fr')),
  );
  const pickerTitle = pickerType === 'class'
    ? 'Choisir une classe'
    : pickerType === 'period'
      ? 'Choisir un trimestre'
      : 'Choisir un élève';
  const selectedPupil = pupils.find((pupil) => pupil.id === pupilId);
  const pupilSelectionLabel = pupilId === 'all'
    ? `Toute la classe · ${pupils.length} élève${pupils.length === 1 ? '' : 's'}`
    : selectedPupil
      ? `${selectedPupil.lastName} ${selectedPupil.firstName}`
      : 'Choisir un élève';
  const openPicker = (type: PickerType) => {
    setPickerQuery('');
    setPickerType(type);
  };
  const selectPickerOption = (optionId: string) => {
    if (pickerType === 'class') setClassId(optionId);
    if (pickerType === 'period') setPeriodId(optionId);
    if (pickerType === 'pupil') setPupilId(optionId);
    setPickerType(null);
  };
  return (
    <Screen>
      <AppHeader eyebrow="Analyse · Impression" title="Bilans trimestriels" />
      <Text style={[styles.help, { color: colors.mutedForeground }]}>
        Consultez les résultats, l’évaluation continue et les présences d’un élève ou de toute la classe sur un trimestre.
      </Text>
      <SectionTitle title="Classe et période" compact />
      <View style={styles.selectionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Classe : ${currentClass?.name ?? 'aucune classe'}`}
          onPress={() => openPicker('class')}
          style={[styles.selectionField, styles.selectionRowField, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.selectionLabel, { color: colors.mutedForeground }]}>CLASSE</Text>
          <View style={styles.selectionValueRow}>
            <Text numberOfLines={1} style={[styles.selectionValue, { color: colors.foreground }]}>
              {currentClass?.name ?? 'Choisir'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Trimestre : ${period?.name ?? 'aucun trimestre'}`}
          disabled={!periods.length}
          onPress={() => openPicker('period')}
          style={[styles.selectionField, styles.selectionRowField, { backgroundColor: colors.card, borderColor: colors.border, opacity: periods.length ? 1 : 0.55 }]}
        >
          <Text style={[styles.selectionLabel, { color: colors.mutedForeground }]}>TRIMESTRE</Text>
          <View style={styles.selectionValueRow}>
            <Text numberOfLines={1} style={[styles.selectionValue, { color: colors.foreground }]}>
              {period?.name ?? 'Non défini'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </View>
        </Pressable>
      </View>
      {periods.length ? (
        period ? (
          <Text style={[styles.periodCaption, { color: colors.mutedForeground }]}>{period.startDate} – {period.endDate}</Text>
        ) : null
      ) : (
        <Surface style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucun trimestre configuré pour cette année. Ajoutez une période depuis Suivi.</Text>
        </Surface>
      )}

      {period ? (
        <>
          <SectionTitle title="Destinataire" compact />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Destinataire : ${pupilSelectionLabel}`}
            onPress={() => openPicker('pupil')}
            style={[styles.selectionField, styles.selectionFullWidth, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.selectionLabel, { color: colors.mutedForeground }]}>ÉLÈVE OU CLASSE ENTIÈRE</Text>
            <View style={styles.selectionValueRow}>
              <Text numberOfLines={1} style={[styles.selectionValue, { color: colors.foreground }]}>
                {pupilSelectionLabel}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </View>
          </Pressable>
          {pupilId === 'all' && selectedReports.length ? (
            <Surface style={styles.classSummary}>
              <View style={[styles.pupilIcon, { backgroundColor: colors.accent }]}>
                <Feather name="users" size={17} color={colors.primary} />
              </View>
              <View style={styles.pupilCopy}>
                <Text style={[styles.pupilName, { color: colors.foreground }]}>
                  Bilan de toute la classe
                </Text>
                <Text style={[styles.help, { color: colors.mutedForeground }]}>
                  {selectedReports.length} bilan{selectedReports.length === 1 ? '' : 's'} seront inclus dans le PDF.
                </Text>
              </View>
            </Surface>
          ) : selectedReports.length ? (
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
                label="Aperçu du bilan"
                icon="eye"
                disabled={!selectedReports.length}
                onPress={() => setPreviewVisible(true)}
              />
            </View>
          )}
        </>
      ) : null}
      <Modal
        visible={pickerType !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerType(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer la sélection"
            onPress={() => setPickerType(null)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
                {pickerTitle}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={() => setPickerType(null)}
                style={[styles.closeButton, { backgroundColor: colors.muted }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            {pickerOptions.length > 6 ? (
              <View style={[styles.searchField, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Feather name="search" size={16} color={colors.mutedForeground} />
                <TextInput
                  value={pickerQuery}
                  onChangeText={setPickerQuery}
                  placeholder="Rechercher"
                  placeholderTextColor={colors.mutedForeground}
                  accessibilityLabel="Rechercher dans la sélection"
                  style={[styles.searchInput, { color: colors.foreground }]}
                />
              </View>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.optionList}
              contentContainerStyle={styles.optionListContent}
            >
              {filteredPickerOptions.map((option) => {
                const selected =
                  (pickerType === 'class' && option.id === classId) ||
                  (pickerType === 'period' && option.id === periodId) ||
                  (pickerType === 'pupil' && option.id === pupilId);
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => selectPickerOption(option.id)}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: selected ? colors.accent : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionLabel, { color: colors.foreground }]}>
                        {option.label}
                      </Text>
                      {option.detail ? (
                        <Text style={[styles.optionDetail, { color: colors.mutedForeground }]}>
                          {option.detail}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <Feather name="check" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
              {!filteredPickerOptions.length ? (
                <Text style={[styles.noOptions, { color: colors.mutedForeground }]}>
                  Aucun résultat.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <PdfPreviewModal
        visible={previewVisible}
        title={`Bilans — ${currentClass?.name ?? ''}`}
        html={previewHtml}
        filename={`Bilans_${currentClass?.name ?? 'Classe'}_${currentClass?.academicYear ?? ''}_${period?.name ?? 'Trimestre'}.pdf`}
        onClose={() => setPreviewVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 12, lineHeight: 18 },
  selectionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  selectionField: { minWidth: 0, height: 58, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', alignSelf: 'flex-start' },
  selectionFullWidth: { alignSelf: 'stretch' },
  selectionRowField: { flex: 1 },
  selectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7, marginBottom: 4 },
  selectionValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectionValue: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '700' },
  periodCaption: { fontSize: 11, marginTop: 5 },
  empty: { padding: 14 },
  emptyText: { fontSize: 12, lineHeight: 18 },
  classSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12 },
  pupilList: { gap: 12, marginTop: 12 },
  pupilCard: { gap: 9 },
  pupilHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pupilIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pupilCopy: { flex: 1, gap: 2 },
  pupilName: { fontSize: 14, fontWeight: '700' },
  average: { fontSize: 18, fontWeight: '800' },
  summary: { fontSize: 11, lineHeight: 17 },
  exportAction: { marginTop: 12 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 12, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  pickerSheet: { width: '100%', maxWidth: 560, maxHeight: '85%', alignSelf: 'center', flexGrow: 0, flexShrink: 1, borderRadius: 22, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pickerTitle: { fontSize: 18, fontWeight: '700' },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  searchField: { minHeight: 42, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14 },
  optionList: { flex: 1, minHeight: 0 },
  optionListContent: { flexGrow: 1, gap: 7, paddingBottom: 4 },
  optionRow: { minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionCopy: { flex: 1, gap: 3 },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  optionDetail: { fontSize: 11 },
  noOptions: { padding: 18, textAlign: 'center', fontSize: 13 },
});
