import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppHeader, Button, KeyboardAvoidingViewCompat, ListSelectionToolbar, Screen, SectionTitle, SelectionCheckbox, Surface } from '@/components/AppShell';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { useListSelection } from '@/hooks/useListSelection';
import {
  downloadFile,
  exportClassAttendancePdf,
  exportContinuousEvaluationPdf,
  generateContinuousEvaluationWorkbook,
} from '@/services/exportService';
import {
  calculateAbsenceScore,
  calculateContinuousTotal,
  calculateDisciplineScore,
  isValidManualScore,
} from '@/services/continuousEvaluation';

export default function ClassDetailScreen() {
  const colors = useColors();
  const data = useAppData();
  const params = useLocalSearchParams<{
    classId: string;
    sessionId?: string;
    attendanceDate?: string;
    evaluationFilter?: 'all' | 'incomplete' | 'complete';
  }>();

  const currentClassId = params.classId || data.activeClassId;
  const currentClass = useMemo(() => {
    return data.classes.find((c) => c.id === currentClassId) ?? data.activeClass;
  }, [data.classes, currentClassId, data.activeClass]);
  const continuousPeriods = data.getContinuousEvaluationPeriods(currentClass.academicYear);
  const activeEvaluationPeriod = data.getActiveContinuousEvaluationPeriod(currentClass.academicYear);

  const classPupils = useMemo(() => {
    return data.getPupilsForClass(currentClass.id);
  }, [data.pupils, currentClass.id]);

  const allAttendanceRecords = useMemo(
    () => data.getAttendanceRecordsForClass(currentClass.id),
    [data.attendanceRecords, currentClass.id],
  );
  const attendanceRecords = useMemo(() => {
    if (!activeEvaluationPeriod) return allAttendanceRecords;
    return allAttendanceRecords.filter((record) =>
      record.date >= activeEvaluationPeriod.startDate &&
      record.date <= activeEvaluationPeriod.endDate,
    );
  }, [
    allAttendanceRecords,
    activeEvaluationPeriod?.startDate,
    activeEvaluationPeriod?.endDate,
  ]);
  const allPupilAttendanceStats = useMemo(
    () => new Map(classPupils.map((pupil) => {
      const stats = allAttendanceRecords.reduce((counts, record) => {
        const status = record.statuses[pupil.id];
        if (status === 'present' || status === 'absent') {
          counts.total += 1;
          if (status === 'present') counts.present += 1;
        }
        return counts;
      }, { present: 0, total: 0 });
      return [pupil.id, stats] as const;
    })),
    [allAttendanceRecords, classPupils],
  );
  const pupilAttendanceStats = useMemo(
    () => new Map(classPupils.map((pupil) => {
      const stats = attendanceRecords.reduce((counts, record) => {
        const status = record.statuses[pupil.id];
        if (status === 'present' || status === 'absent') {
          counts.total += 1;
          if (status === 'present') counts.present += 1;
        }
        return counts;
      }, { present: 0, total: 0 });
      return [pupil.id, stats] as const;
    })),
    [attendanceRecords, classPupils],
  );
  const continuousEvaluationRows = useMemo(
    () => classPupils.map((pupil) => {
      const evaluation = data.getContinuousEvaluation(
        pupil.id,
        currentClass.id,
        currentClass.academicYear,
        activeEvaluationPeriod?.id,
      );
      const events = evaluation
        ? data.getDisciplineEventsForEvaluation(evaluation.id)
        : [];
      const attendance = pupilAttendanceStats.get(pupil.id) ?? { present: 0, total: 0 };
      const absenceScore = calculateAbsenceScore({
        totalSessions: attendance.total,
        presentCount: attendance.present,
        absentCount: attendance.total - attendance.present,
      }, {
        maximumScore: 5,
        penaltyPerAbsence: data.continuousEvaluationSettings.absencePenaltyPerAbsence,
      });
      const disciplineScore = calculateDisciplineScore(
        events.map((event) => event.penalty),
      );
      return {
        pupil,
        cahierScore: evaluation?.cahierScore,
        participationScore: evaluation?.participationScore,
        absenceScore,
        disciplineScore,
        presentSessions: attendance.present,
        absentSessions: attendance.total - attendance.present,
        attendanceSessions: attendance.total,
        totalScore: calculateContinuousTotal({
          cahierScore: evaluation?.cahierScore ?? 0,
          participationScore: evaluation?.participationScore ?? 0,
          absenceScore,
          disciplineScore,
        }),
      };
    }),
    [
      classPupils,
      currentClass.id,
      currentClass.academicYear,
      activeEvaluationPeriod?.id,
      pupilAttendanceStats,
      data.continuousEvaluations,
      data.disciplineEvents,
      data.continuousEvaluationSettings,
    ],
  );
  const attendanceCounts = [...allPupilAttendanceStats.values()].reduce(
    (counts, pupilStats) => ({
      present: counts.present + pupilStats.present,
      total: counts.total + pupilStats.total,
    }),
    { present: 0, total: 0 },
  );
  const classAttendanceRate = attendanceCounts.total
    ? Math.round((attendanceCounts.present / attendanceCounts.total) * 100)
    : null;

  const openAttendance = () => {
    const now = new Date();
    const attendanceDate = params.attendanceDate && /^\d{4}-\d{2}-\d{2}$/.test(params.attendanceDate)
      ? params.attendanceDate
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    router.push({
      pathname: '/classes/[classId]/attendance',
      params: {
        classId: currentClass.id,
        sessionId: params.sessionId ?? '',
        date: attendanceDate,
      },
    });
  };

  const exportAttendanceList = async () => {
    setIsExportingAttendance(true);
    try {
      await exportClassAttendancePdf({
        schoolName: data.school.name,
        teacherName: data.teacherName,
        className: currentClass.name,
        level: currentClass.level,
        academicYear: currentClass.academicYear,
        pupils: classPupils.map((pupil) => {
          const stats = allPupilAttendanceStats.get(pupil.id) ?? { present: 0, total: 0 };
          return {
            registrationNumber: pupil.registrationNumber,
            firstName: pupil.firstName,
            lastName: pupil.lastName,
            present: stats.present,
            absent: stats.total - stats.present,
            total: stats.total,
            absentDates: allAttendanceRecords
              .filter((record) => record.statuses[pupil.id] === 'absent')
              .sort((left, right) => left.date.localeCompare(right.date))
              .map((record) => new Date(`${record.date}T00:00:00`).toLocaleDateString('fr-FR')),
          };
        }),
      });
    } catch (error) {
      Alert.alert('Export impossible', error instanceof Error ? error.message : 'Impossible de générer la liste de présence.');
    } finally {
      setIsExportingAttendance(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'pupils' | 'continuous'>('continuous');
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [evaluationFilter, setEvaluationFilter] = useState<'all' | 'incomplete' | 'complete'>(
    params.evaluationFilter === 'incomplete' ? 'incomplete' : 'all',
  );
  const [evaluationToolsExpanded, setEvaluationToolsExpanded] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; eventId?: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const participationInputRefs = useRef<Record<string, TextInput | null>>({});
  useEffect(() => {
    setActiveTab('continuous');
    setScoreDrafts({});
    setEvaluationFilter(
      params.evaluationFilter === 'incomplete' ? 'incomplete' : 'all',
    );
  }, [currentClass.id, params.evaluationFilter]);
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);
  const pupilSelection = useListSelection();
  const [classDeleteArmed, setClassDeleteArmed] = useState(false);
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);
  const [exportingContinuousFormat, setExportingContinuousFormat] = useState<'pdf' | 'excel' | null>(null);

  const [classNameModalVisible, setClassNameModalVisible] = useState(false);
  const [classNameInput, setClassNameInput] = useState('');
  // Add Pupil Modal State
  const [pupilModalVisible, setPupilModalVisible] = useState(false);
  const [newPupilLastName, setNewPupilLastName] = useState('');
  const [newPupilFirstName, setNewPupilFirstName] = useState('');
  const [newPupilRegNo, setNewPupilRegNo] = useState('');
  const [newPupilDob, setNewPupilDob] = useState('');
  const [showPupilDobPicker, setShowPupilDobPicker] = useState(false);

  const exportContinuousEvaluation = async (format: 'pdf' | 'excel') => {
    setExportingContinuousFormat(format);
    try {
      const exportData = {
        schoolName: data.school.name,
        teacherName: data.teacherName,
        className: currentClass.name,
        level: currentClass.level,
        academicYear: currentClass.academicYear,
        evaluationPeriodName: activeEvaluationPeriod?.name,
        evaluationPeriodStartDate: activeEvaluationPeriod?.startDate,
        evaluationPeriodEndDate: activeEvaluationPeriod?.endDate,
        pupils: continuousEvaluationRows.map((row) => ({
          registrationNumber: row.pupil.registrationNumber,
          firstName: row.pupil.firstName,
          lastName: row.pupil.lastName,
          cahierScore: row.cahierScore,
          participationScore: row.participationScore,
          absenceScore: row.absenceScore,
          disciplineScore: row.disciplineScore,
          totalScore: row.totalScore,
          evaluationComplete:
            row.cahierScore !== undefined && row.participationScore !== undefined,
          presentSessions: row.presentSessions,
          absentSessions: row.absentSessions,
          attendanceSessions: row.attendanceSessions,
        })),
      };
      const safeClassName = currentClass.name.replace(/[^\p{L}\p{N}-]+/gu, '_');
      const safeAcademicYear = currentClass.academicYear.replace(/[^\p{L}\p{N}-]+/gu, '_');
      const safePeriodName = (activeEvaluationPeriod?.name ?? 'evaluation')
        .replace(/[^\p{L}\p{N}-]+/gu, '_');
      if (format === 'pdf') {
        await exportContinuousEvaluationPdf(exportData);
      } else {
        const workbook = await generateContinuousEvaluationWorkbook(exportData);
        await downloadFile(
          workbook,
          `Evaluation_continue_${safeClassName}_${safeAcademicYear}_${safePeriodName}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      }
    } catch (error) {
      console.error(`Erreur export évaluation continue (${format}):`, error);
      Alert.alert(
        'Export impossible',
        error instanceof Error
          ? error.message
          : `Impossible de générer le fichier ${format === 'pdf' ? 'PDF' : 'Excel'}.`,
      );
    } finally {
      setExportingContinuousFormat(null);
    }
  };

  const saveContinuousScore = (
    pupilId: string,
    field: 'cahierScore' | 'participationScore',
    value: string,
  ) => {
    const key = `${pupilId}:${field}`;
    const score = Number(value.replace(',', '.'));
    if (!value.trim()) {
      setScoreDrafts((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      return;
    }
    if (!isValidManualScore(score)) {
      Alert.alert('Note invalide', 'La note doit être comprise entre 0 et 5.');
      setScoreDrafts((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      return;
    }
    if (!data.setContinuousEvaluationScore(
      pupilId,
      currentClass.id,
      currentClass.academicYear,
      field,
      score,
      activeEvaluationPeriod?.id,
    )) {
      Alert.alert('Enregistrement impossible', 'La note n’a pas pu être sauvegardée.');
      setScoreDrafts((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      return;
    }
    setFeedback({ message: 'Note enregistrée.' });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
    setScoreDrafts((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const addQuickDisciplinePenalty = (pupilId: string) => {
    const eventId = data.addDisciplinePenalty(
      pupilId,
      currentClass.id,
      currentClass.academicYear,
      undefined,
      activeEvaluationPeriod?.id,
    );
    if (!eventId) {
      Alert.alert('Enregistrement impossible', 'La pénalité disciplinaire n’a pas pu être enregistrée.');
      return;
    }
    setFeedback({ message: 'Pénalité ajoutée.', eventId });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 5000);
  };

  const undoQuickDisciplinePenalty = () => {
    if (!feedback?.eventId) return;
    if (!data.deleteDisciplineEvent(feedback.eventId)) {
      Alert.alert('Annulation impossible', 'La pénalité n’a pas pu être annulée.');
      return;
    }
    setFeedback({ message: 'Pénalité annulée.' });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const completedEvaluationCount = continuousEvaluationRows.filter(
    (row) => row.cahierScore !== undefined && row.participationScore !== undefined,
  ).length;
  const normalizedStudentSearch = studentSearch.trim().toLocaleLowerCase();
  const visibleEvaluationRows = continuousEvaluationRows.filter((row) => {
    const isComplete =
      row.cahierScore !== undefined && row.participationScore !== undefined;
    const matchesStatus =
      evaluationFilter === 'all' ||
      (evaluationFilter === 'complete' && isComplete) ||
      (evaluationFilter === 'incomplete' && !isComplete);
    const matchesSearch =
      !normalizedStudentSearch ||
      `${row.pupil.firstName} ${row.pupil.lastName} ${row.pupil.registrationNumber}`
        .toLocaleLowerCase()
        .includes(normalizedStudentSearch);
    return matchesStatus && matchesSearch;
  });

  const openAddPupilModal = () => {
    const nextNum = String(classPupils.length + 1).padStart(2, '0');
    setNewPupilRegNo(nextNum);
    setNewPupilLastName('');
    setNewPupilFirstName('');
    setNewPupilDob('');
    setShowPupilDobPicker(false);
    setPupilModalVisible(true);
  };

  const getPupilDobValue = () => {
    if (!newPupilDob) return new Date();
    const [year, month, day] = newPupilDob.split('-').map(Number);
    const value = new Date(year, month - 1, day);
    return Number.isNaN(value.getTime()) ? new Date() : value;
  };

  const formatPupilDob = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

  const openClassNameModal = () => {
    setClassNameInput(currentClass.name);
    setClassNameModalVisible(true);
  };

  const handleRenameClass = () => {
    if (!classNameInput.trim()) {
      Alert.alert('Nom obligatoire', 'Veuillez saisir un nom pour la classe.');
      return;
    }
    if (!data.renameClass(currentClass.id, classNameInput)) {
      Alert.alert('Modification impossible', 'La classe n’a pas pu être renommée.');
      return;
    }
    setClassNameModalVisible(false);
  };

  const handleAddPupil = () => {
    if (!newPupilLastName.trim() || !newPupilFirstName.trim()) {
      Alert.alert('Champs obligatoires', 'Veuillez saisir le nom et le prénom de l’élève.');
      return;
    }
    const result = data.addPupils(
      [
        {
          lastName: newPupilLastName.trim(),
          firstName: newPupilFirstName.trim(),
          registrationNumber: newPupilRegNo.trim() || String(classPupils.length + 1).padStart(2, '0'),
          dateOfBirth: newPupilDob.trim() || undefined,
        },
      ],
      currentClass.id,
    );
    if (result.imported > 0) {
      setPupilModalVisible(false);
      Alert.alert('Élève ajouté', `${newPupilLastName.trim()} ${newPupilFirstName.trim()} a été ajouté(e) avec succès.`);
    } else {
      Alert.alert('Attention', 'Impossible d’ajouter cet élève.');
    }
  };

  const deleteSelectedPupils = () => {
    const selected = classPupils.filter((pupil) => pupilSelection.selectedIds.includes(pupil.id));
    if (selected.length === 0) return;
    Alert.alert('Supprimer les élèves sélectionnés ?', `Retirer ${selected.length} élève${selected.length > 1 ? 's' : ''} de ${currentClass.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { selected.forEach((pupil) => data.deletePupil(pupil.id)); pupilSelection.cancelSelection(); } },
    ]);
  };

  const handleDeleteClass = () => {
    Alert.alert(
      'Supprimer la classe',
      `Êtes-vous sûr de vouloir supprimer définitivement la classe "${currentClass.name}" ?\n\nTous les élèves, évaluations et notes de cette classe seront effacés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            data.deleteClass(currentClass.id);
            Alert.alert('Classe supprimée', `La classe ${currentClass.name} a été supprimée.`);
            router.replace('/classes');
          },
        },
      ],
    );
  };

  if (!currentClass || !currentClass.id) {
    return (
      <Screen>
        <AppHeader eyebrow="Classes" title="Classe introuvable" onBack={() => router.back()} />
        <Surface style={styles.emptyCard}>
          <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Cette classe n’existe pas</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Elle a peut-être été supprimée ou n’a pas encore été créée.
          </Text>
          <Button label="Retour aux classes" icon="arrow-left" onPress={() => router.replace('/classes')} />
        </Surface>
      </Screen>
    );
  }

  return (
    <Screen onTouchStart={() => setClassDeleteArmed(false)}>
      <AppHeader
        eyebrow="Classe"
        title={currentClass.name}
        onBack={() => router.back()}
        onTitleLongPress={() => setClassDeleteArmed(true)}
        titleActionArmed={classDeleteArmed}
        compact
      />

      {/* Class Overview Card */}
      <Surface style={styles.classInfo}>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>NIVEAU</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{currentClass.level}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>ÉLÈVES</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{classPupils.length}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>ANNÉE</Text>
          <Text style={[styles.infoValue, { color: colors.primary }]}>{currentClass.academicYear}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Modifier le nom de la classe"
          onPress={openClassNameModal}
          style={[styles.editClassButton, { backgroundColor: colors.accent }]}
        >
          <Feather name="edit-2" size={16} color={colors.primary} />
        </Pressable>
      </Surface>
      {activeTab !== 'continuous' && (
      <Surface style={[styles.attendanceSummary, { borderColor: colors.border }]}>
        <View style={styles.attendanceSummaryCopy}>
          <Text style={[styles.attendanceSummaryTitle, { color: colors.foreground }]}>Présence de la classe</Text>
          <Text style={[styles.attendanceSummaryMeta, { color: colors.mutedForeground }]}>
            {classAttendanceRate === null
              ? 'Aucun appel enregistré'
              : `${classAttendanceRate}% · ${allAttendanceRecords.length} appel${allAttendanceRecords.length > 1 ? 's' : ''} enregistré${allAttendanceRecords.length > 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={styles.attendanceActions}>
          <Button label="Faire l’appel" icon="check-square" compact onPress={openAttendance} />
          <Button
            label={isExportingAttendance ? 'Préparation…' : 'Exporter la liste'}
            icon="download"
            compact
            secondary
            disabled={isExportingAttendance}
            onPress={() => { void exportAttendanceList(); }}
          />
        </View>
      </Surface>
      )}

      {/* Continuous evaluation is the default class workflow. */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('continuous')}
          style={[
            styles.tabItem,
            {
              backgroundColor: activeTab === 'continuous' ? colors.primary : colors.card,
              borderColor: activeTab === 'continuous' ? colors.primary : colors.border,
            },
          ]}
        >
          <Feather
            name="clipboard"
            size={16}
            color={activeTab === 'continuous' ? colors.primaryForeground : colors.foreground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'continuous' ? colors.primaryForeground : colors.foreground },
            ]}
          >
            Évaluation continue
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('pupils')}
          style={[
            styles.tabItem,
            {
              backgroundColor: activeTab === 'pupils' ? colors.primary : colors.card,
              borderColor: activeTab === 'pupils' ? colors.primary : colors.border,
            },
          ]}
        >
          <Feather
            name="users"
            size={16}
            color={activeTab === 'pupils' ? colors.primaryForeground : colors.foreground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'pupils' ? colors.primaryForeground : colors.foreground },
            ]}
          >
            Élèves
          </Text>
        </Pressable>
      </View>

      {activeTab === 'continuous' && (
        <View style={styles.tabContent}>
          <SectionTitle
            title={`Évaluation continue · ${currentClass.academicYear}`}
            action="+ Ajouter un élève"
            compact
            onAction={openAddPupilModal}
          />
          <View style={styles.periodSelector}>
            {continuousPeriods.map((period) => (
              <Pressable
                key={period.id}
                accessibilityRole="button"
                accessibilityState={{ selected: period.id === activeEvaluationPeriod?.id }}
                onPress={() => {
                  setScoreDrafts({});
                  data.setActiveContinuousEvaluationPeriod(currentClass.academicYear, period.id);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: period.id === activeEvaluationPeriod?.id ? colors.primary : colors.card,
                    borderColor: period.id === activeEvaluationPeriod?.id ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.filterChipText, {
                  color: period.id === activeEvaluationPeriod?.id ? colors.primaryForeground : colors.foreground,
                }]}>
                  {period.name}
                </Text>
              </Pressable>
            ))}
            <Button
              label="Périodes"
              icon="calendar"
              secondary
              compact
              onPress={() => router.push('/continuous')}
            />
          </View>
          <Text style={[styles.periodCaption, { color: colors.mutedForeground }]}>
            {activeEvaluationPeriod
              ? `${activeEvaluationPeriod.startDate} – ${activeEvaluationPeriod.endDate}`
              : 'Aucune période définie pour cette année scolaire'}
          </Text>
          <Text style={[styles.progressSummary, { color: colors.mutedForeground }]}>
            {completedEvaluationCount}/{classPupils.length} complets · notes sur 5 sauvegardées automatiquement
          </Text>
          <Text style={[styles.evaluationHint, { color: colors.mutedForeground }]}>
            Validez une note puis passez directement au champ suivant. Touchez le nom pour l’historique.
          </Text>
          <Surface style={styles.toolsCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={evaluationToolsExpanded ? 'Réduire les outils de la classe' : 'Afficher les outils de la classe'}
              accessibilityState={{ expanded: evaluationToolsExpanded }}
              onPress={() => setEvaluationToolsExpanded((expanded) => !expanded)}
              style={styles.toolsHeader}
            >
              <View style={[styles.toolsIcon, { backgroundColor: colors.accent }]}>
                <Feather name="sliders" size={16} color={colors.primary} />
              </View>
              <View style={styles.toolsHeaderCopy}>
                <Text style={[styles.toolsTitle, { color: colors.foreground }]}>Outils de la classe</Text>
                {!evaluationToolsExpanded ? (
                  <Text style={[styles.toolsSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {evaluationFilter === 'incomplete'
                      ? 'Filtre : à compléter · appel · exports · recherche'
                      : evaluationFilter === 'complete'
                        ? 'Filtre : terminés · appel · exports · recherche'
                        : 'Appel · exports PDF/Excel · recherche et filtres'}
                  </Text>
                ) : null}
              </View>
              <Feather
                name={evaluationToolsExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
            {evaluationToolsExpanded ? (
              <View style={[styles.toolsContent, { borderTopColor: colors.border }]}>
                <View style={styles.continuousExportActions}>
                  <Button
                    label={exportingContinuousFormat === 'pdf' ? 'Préparation PDF…' : 'PDF'}
                    icon="file-text"
                    secondary
                    compact
                    disabled={exportingContinuousFormat !== null}
                    onPress={() => { void exportContinuousEvaluation('pdf'); }}
                  />
                  <Button
                    label={exportingContinuousFormat === 'excel' ? 'Préparation Excel…' : 'Excel'}
                    icon="download"
                    secondary
                    compact
                    disabled={exportingContinuousFormat !== null}
                    onPress={() => { void exportContinuousEvaluation('excel'); }}
                  />
                  <Button label="Faire l’appel" icon="check-square" secondary compact onPress={openAttendance} />
                </View>
                <View style={[styles.studentSearch, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Feather name="search" size={16} color={colors.mutedForeground} />
                  <TextInput
                    accessibilityLabel="Rechercher un élève"
                    value={studentSearch}
                    onChangeText={setStudentSearch}
                    placeholder="Rechercher un élève"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.studentSearchInput, { color: colors.foreground }]}
                  />
                  {studentSearch ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Effacer la recherche"
                      onPress={() => setStudentSearch('')}
                    >
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.filterChips}>
                  {([
                    ['all', 'Tous'],
                    ['incomplete', 'À compléter'],
                    ['complete', 'Terminés'],
                  ] as const).map(([filter, label]) => (
                    <Pressable
                      key={filter}
                      accessibilityRole="button"
                      accessibilityState={{ selected: evaluationFilter === filter }}
                      onPress={() => setEvaluationFilter(filter)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: evaluationFilter === filter ? colors.primary : colors.card,
                          borderColor: evaluationFilter === filter ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.filterChipText, {
                        color: evaluationFilter === filter ? colors.primaryForeground : colors.foreground,
                      }]}>
                        {label}{filter === 'incomplete' ? ` (${classPupils.length - completedEvaluationCount})` : filter === 'complete' ? ` (${completedEvaluationCount})` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </Surface>
          {feedback ? (
            <View style={[styles.feedbackBanner, { backgroundColor: colors.successSurface }]}>
              <Text style={[styles.feedbackText, { color: colors.successForeground }]}>
                {feedback.message}
              </Text>
              {feedback.eventId ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={undoQuickDisciplinePenalty}
                  style={[styles.undoButton, { backgroundColor: colors.card }]}
                >
                  <Text style={[styles.undoButtonText, { color: colors.foreground }]}>Annuler</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {visibleEvaluationRows.length ? visibleEvaluationRows.map((row) => (
            <Surface
              key={row.pupil.id}
              style={[styles.evaluationPupilRow, { borderColor: colors.border }]}
            >
              <View style={styles.evaluationPupilHeading}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir l'historique de ${row.pupil.firstName} ${row.pupil.lastName}`}
                  onPress={() => router.push(`/pupils/${row.pupil.id}`)}
                  style={styles.evaluationPupilIdentity}
                >
                  <Text style={[styles.evaluationPupilName, { color: colors.foreground }]}>
                    {row.pupil.lastName} {row.pupil.firstName}
                  </Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
                <View style={styles.evaluationTotalGroup}>
                  <Text style={[styles.scoreFieldLabel, { color: colors.mutedForeground }]}>TOTAL</Text>
                  <Text style={[styles.evaluationTotal, { color: colors.primary }]}>
                    {row.cahierScore !== undefined && row.participationScore !== undefined
                      ? `${row.totalScore}/20`
                      : '—/20'}
                  </Text>
                </View>
              </View>
              <View style={styles.manualScoreRow}>
                <View style={styles.manualScoreField}>
                  <Text style={[styles.scoreFieldLabel, { color: colors.mutedForeground }]}>CAHIER /5</Text>
                  <TextInput
                    accessibilityLabel={`Note du cahier de ${row.pupil.firstName} sur 5`}
                    value={scoreDrafts[`${row.pupil.id}:cahierScore`] ?? (row.cahierScore === undefined ? '' : String(row.cahierScore))}
                    onTouchStart={(event) => event.stopPropagation()}
                    onChangeText={(value) => setScoreDrafts((previous) => ({
                      ...previous,
                      [`${row.pupil.id}:cahierScore`]: value,
                    }))}
                    onEndEditing={(event) => saveContinuousScore(row.pupil.id, 'cahierScore', event.nativeEvent.text)}
                    onSubmitEditing={() => participationInputRefs.current[row.pupil.id]?.focus()}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    selectTextOnFocus
                    style={[styles.inlineScoreInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                </View>
                <View style={styles.manualScoreField}>
                  <Text style={[styles.scoreFieldLabel, { color: colors.mutedForeground }]}>PARTICIPATION /5</Text>
                  <TextInput
                    accessibilityLabel={`Note de participation de ${row.pupil.firstName} sur 5`}
                    value={scoreDrafts[`${row.pupil.id}:participationScore`] ?? (row.participationScore === undefined ? '' : String(row.participationScore))}
                    ref={(ref) => { participationInputRefs.current[row.pupil.id] = ref; }}
                    onTouchStart={(event) => event.stopPropagation()}
                    onChangeText={(value) => setScoreDrafts((previous) => ({
                      ...previous,
                      [`${row.pupil.id}:participationScore`]: value,
                    }))}
                    onEndEditing={(event) => saveContinuousScore(row.pupil.id, 'participationScore', event.nativeEvent.text)}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    selectTextOnFocus
                    style={[styles.inlineScoreInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                </View>
              </View>
              <View style={[styles.calculatedScoreRow, { borderTopColor: colors.border }]}>
                <View style={styles.calculatedScoreGroup}>
                  <Text style={[styles.scoreFieldLabel, { color: colors.mutedForeground }]}>ABSENCES</Text>
                  <Text style={[styles.calculatedScoreValue, { color: colors.foreground }]}>{row.absenceScore}/5</Text>
                </View>
                <View style={styles.calculatedScoreGroup}>
                  <Text style={[styles.scoreFieldLabel, { color: colors.mutedForeground }]}>DISCIPLINE</Text>
                  <Text style={[styles.calculatedScoreValue, { color: colors.foreground }]}>{row.disciplineScore}/5</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter une pénalité de discipline à ${row.pupil.firstName} ${row.pupil.lastName}`}
                  onPress={() => addQuickDisciplinePenalty(row.pupil.id)}
                  style={[styles.quickPenaltyButton, { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.quickPenaltyText, { color: colors.primary }]}>
                    − {data.continuousEvaluationSettings.disciplinePenalty}
                  </Text>
                </Pressable>
              </View>
            </Surface>
          )) : (
            <Surface style={styles.emptyCard}>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {continuousEvaluationRows.length === 0
                  ? 'Aucun élève n’est encore inscrit dans cette classe.'
                  : 'Aucun élève ne correspond à cette recherche ou à ce filtre.'}
              </Text>
            </Surface>
          )}
        </View>
      )}

      {/* Roster management remains separate from continuous evaluation. */}
      {activeTab === 'pupils' && (
        <View style={styles.tabContent}>
          <SectionTitle
            title="Élèves de la classe"
            action="+ Ajouter un élève"
            compact
            onAction={openAddPupilModal}
          />
          <ListSelectionToolbar
            style={{ marginBottom: 0 }}
            active={pupilSelection.isSelecting}
            selectedCount={pupilSelection.selectedIds.length}
            onStart={() => pupilSelection.startSelecting()}
            onCancel={pupilSelection.cancelSelection}
            onDelete={deleteSelectedPupils}
          />

          <View style={styles.pupilList}>
            {classPupils.length === 0 ? (
              <Surface style={styles.emptyPupils}>
                <Feather name="users" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Aucun élève dans cette classe</Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  Ajoutez un premier élève ou importez la liste complète de la classe.
                </Text>
              </Surface>
            ) : (
              classPupils.map((pupil, index) => {
                const pupilStats = allPupilAttendanceStats.get(pupil.id) ?? { present: 0, total: 0 };
                const presenceLabel = pupilStats.total
                  ? `Présence : ${Math.round((pupilStats.present / pupilStats.total) * 100)}% (${pupilStats.present}/${pupilStats.total})`
                  : 'Présence : aucun appel';
                return <Pressable
                  key={pupil.id}
                  onTouchStart={(event) => event.stopPropagation()}
                  onPress={() => {
                    if (pupilSelection.isSelecting) pupilSelection.toggleSelection(pupil.id);
                    else router.push(`/pupils/${pupil.id}`);
                  }}
                  style={[
                    styles.pupilRow,
                    pupilSelection.selectedIds.includes(pupil.id)
                      ? { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2, borderRadius: 10, paddingHorizontal: 8 }
                      : { borderBottomColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: index % 2 ? colors.accent : colors.secondary },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.foreground }]}>
                      {pupil.lastName.charAt(0)}
                      {pupil.firstName.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.pupilCopy}>
                    <Text style={[styles.pupilName, { color: colors.foreground }]}>
                      {pupil.lastName} {pupil.firstName}
                    </Text>
                    <Text style={[styles.pupilMeta, { color: colors.mutedForeground }]}>
                      N° {pupil.registrationNumber} {pupil.dateOfBirth ? `· Né(e) le ${pupil.dateOfBirth}` : ''}
                    </Text>
                    <Text style={[styles.pupilMeta, { color: colors.primary }]}>
                      {presenceLabel}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    {pupilSelection.isSelecting ? (
                      <SelectionCheckbox checked={pupilSelection.selectedIds.includes(pupil.id)} />
                    ) : <Feather name="chevron-right" size={17} color={colors.mutedForeground} />}
                  </View>
                </Pressable>;
              })
            )}
          </View>

          <View style={styles.pupilActions}>
            <Button
              label="+ Ajouter un élève"
              icon="user-plus"
              onPress={openAddPupilModal}
            />
            <Button
              label="Importer des élèves (CSV/Texte)"
              icon="upload"
              secondary
              onPress={() => router.push(`/classes/${currentClass.id}/import`)}
            />
          </View>
        </View>
      )}

      {/* Delete Class Section */}
      <View style={styles.deleteClassSection}>
        {classDeleteArmed ? (
          <Button label="Supprimer cette classe" icon="trash-2" secondary onTouchStart={(event) => event.stopPropagation()} onPress={() => { setClassDeleteArmed(false); handleDeleteClass(); }} />
        ) : null}
      </View>

      <Modal
        visible={classNameModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setClassNameModalVisible(false)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalOverlay}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Modifier la classe
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  Le nouveau nom sera utilisé partout dans l’application.
                </Text>
              </View>
              <Pressable
                onPress={() => setClassNameModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                NOM DE LA CLASSE
              </Text>
              <TextInput
                autoFocus
                value={classNameInput}
                onChangeText={setClassNameInput}
                placeholder="Nom de la classe"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.textInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
            </View>
            <View style={styles.modalButtons}>
              <Button label="Annuler" secondary onPress={() => setClassNameModalVisible(false)} />
              <Button label="Enregistrer" icon="check" onPress={handleRenameClass} />
            </View>
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>

      {/* Modal: Ajouter un élève */}
      <Modal
        visible={pupilModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPupilModalVisible(false)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalOverlay}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Ajouter un élève
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  Classe : {currentClass.name} ({currentClass.level})
                </Text>
              </View>
              <Pressable
                onPress={() => setPupilModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <KeyboardAwareScrollViewCompat bottomOffset={100} contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  NOM DE FAMILLE *
                </Text>
                <TextInput
                  placeholder="Ex. Benali"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPupilLastName}
                  onChangeText={setNewPupilLastName}
                  style={[
                    styles.textInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  PRÉNOM *
                </Text>
                <TextInput
                  placeholder="Ex. Amina"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPupilFirstName}
                  onChangeText={setNewPupilFirstName}
                  style={[
                    styles.textInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  N° D’ORDRE / IMMATRICULATION
                </Text>
                <TextInput
                  placeholder="Ex. 01"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPupilRegNo}
                  onChangeText={setNewPupilRegNo}
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  DATE DE NAISSANCE (FACULTATIF)
                </Text>
                {Platform.OS === 'web' ? (
                  React.createElement('input', {
                    type: 'date',
                    'aria-label': 'Date de naissance',
                    value: newPupilDob,
                    onChange: (event: { currentTarget: { value: string } }) => setNewPupilDob(event.currentTarget.value),
                    style: { height: 44, padding: '0 12px', borderWidth: 1, borderStyle: 'solid', borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background, color: colors.foreground, fontSize: 14 },
                  })
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Date de naissance : ${newPupilDob || 'Choisir une date'}`}
                      onPress={() => setShowPupilDobPicker((visible) => !visible)}
                      style={[styles.textInput, styles.pupilDatePickerButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    >
                      <Feather name="calendar" size={16} color={colors.primary} />
                      <Text style={[styles.pupilDatePickerText, { color: newPupilDob ? colors.foreground : colors.mutedForeground }]}>
                        {newPupilDob || 'Choisir une date'}
                      </Text>
                    </Pressable>
                    {showPupilDobPicker ? (
                      <View style={[styles.pupilDatePicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <DateTimePicker
                          value={getPupilDobValue()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          maximumDate={new Date()}
                          onValueChange={(_, selectedDate) => {
                            setNewPupilDob(formatPupilDob(selectedDate));
                            if (Platform.OS !== 'ios') setShowPupilDobPicker(false);
                          }}
                          onDismiss={() => setShowPupilDobPicker(false)}
                        />
                        {Platform.OS === 'ios' ? (
                          <Pressable accessibilityRole="button" onPress={() => setShowPupilDobPicker(false)} style={styles.pupilDatePickerDone}>
                            <Text style={[styles.pupilDatePickerDoneText, { color: colors.primary }]}>Terminé</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                )}
              </View>

              <View style={styles.modalButtons}>
                <Button
                  label="Annuler"
                  secondary
                  onPress={() => setPupilModalVisible(false)}
                />
                <Button
                  label="Enregistrer l’élève"
                  icon="check"
                  onPress={handleAddPupil}
                />
              </View>
            </KeyboardAwareScrollViewCompat>
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  classInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  attendanceSummary: { flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 10, borderWidth: 1, borderRadius: 14, marginBottom: 10 },
  attendanceSummaryCopy: { flex: 1, gap: 3 },
  attendanceSummaryTitle: { fontSize: 14, fontWeight: '700' },
  attendanceSummaryMeta: { fontSize: 12 },
  attendanceActions: { flexDirection: 'row', gap: 10 },
  infoCol: {
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  editClassButton: {
    width: 36,
    height: 36,
    alignSelf: 'center',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
  },
  tabItem: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  evaluationPupilRow: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  evaluationPupilHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  evaluationPupilIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  evaluationPupilName: { fontSize: 14, fontWeight: '700' },
  evaluationTotal: { fontSize: 15, fontWeight: '800' },
  evaluationTotalGroup: { alignItems: 'flex-end', gap: 2 },
  evaluationHint: { fontSize: 12, lineHeight: 18, marginTop: -7 },
  progressSummary: { fontSize: 11, lineHeight: 15, marginTop: -8 },
  periodSelector: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 2 },
  periodCaption: { fontSize: 11, marginTop: -3 },
  toolsCard: { padding: 9, gap: 8 },
  toolsHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 9 },
  toolsIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  toolsHeaderCopy: { flex: 1, gap: 2 },
  toolsTitle: { fontSize: 12, fontWeight: '800' },
  toolsSubtitle: { fontSize: 10.5, lineHeight: 14 },
  toolsContent: { gap: 9, paddingTop: 7, borderTopWidth: StyleSheet.hairlineWidth },
  continuousExportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  studentSearch: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  studentSearchInput: { flex: 1, minHeight: 40, fontSize: 13 },
  filterChips: { flexDirection: 'row', gap: 6 },
  filterChip: { flex: 1, minHeight: 35, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterChipText: { fontSize: 10, fontWeight: '700' },
  feedbackBanner: { minHeight: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 11, paddingVertical: 5 },
  feedbackText: { flex: 1, fontSize: 12, fontWeight: '700' },
  undoButton: { minHeight: 30, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 11 },
  undoButtonText: { fontSize: 11, fontWeight: '800' },
  manualScoreRow: { flexDirection: 'row', gap: 10 },
  manualScoreField: { flex: 1, gap: 4 },
  scoreFieldLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  inlineScoreInput: { height: 38, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, fontSize: 14 },
  calculatedScoreRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  calculatedScoreGroup: { flex: 1, gap: 3 },
  calculatedScoreValue: { fontSize: 13, fontWeight: '700' },
  quickPenaltyButton: { minHeight: 38, minWidth: 70, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  quickPenaltyText: { fontSize: 12, fontWeight: '800' },
  tabContent: {
    gap: 12,
    paddingBottom: 30,
  },
  assessmentList: {
    gap: 12,
  },
  assessmentCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  assessmentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  competencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  competencyBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  assessmentTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    fontSize: 11.5,
  },
  metaDot: {
    fontSize: 11.5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cardActionButton: {
    flex: 1,
    minWidth: 0,
  },
  pupilList: {
    borderRadius: 14,
  },
  pupilRow: {
    minHeight: 56,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  pupilCopy: {
    flex: 1,
    gap: 2,
  },
  pupilName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  pupilMeta: {
    fontSize: 11.5,
  },
  pupilActions: {
    marginTop: 12,
    gap: 12,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deletePupilBtn: {
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  emptyPupils: {
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalForm: {
    gap: 14,
    paddingBottom: 10,
  },
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  pupilDatePickerButton: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pupilDatePickerText: { fontSize: 14, fontWeight: '600' },
  pupilDatePicker: { alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 8 },
  pupilDatePickerDone: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 7 },
  pupilDatePickerDoneText: { fontSize: 14, fontWeight: '700' },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  deleteAssessBtn: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionText: { fontSize: 11, fontWeight: '700' },
  deleteClassSection: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    marginBottom: 16,
  },
});