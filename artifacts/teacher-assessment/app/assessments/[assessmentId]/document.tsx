import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppHeader, Button, Screen, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import {
  AssessmentExportData,
  downloadFile,
  exportAssessmentPdf,
  generateAssessmentDocx,
  generateAssessmentExcel,
} from '@/services/exportService';

export default function AssessmentDocumentScreen() {
  const colors = useColors();
  const data = useAppData();
  const { assessmentId } = useLocalSearchParams<{ assessmentId: string }>();

  // Determine active/target assessment
  const currentAssessment = useMemo(() => {
    return (assessmentId ? data.getAssessment(assessmentId) : null) ?? data.assessment;
  }, [assessmentId, data.assessments, data.assessment]);

  // Determine active/target class
  const currentClass = useMemo(() => {
    return data.classes.find((c) => c.id === currentAssessment.classId) ?? data.activeClass;
  }, [data.classes, currentAssessment.classId, data.activeClass]);

  // Pupils for this specific class
  const currentPupils = useMemo(() => {
    return data.getPupilsForClass(currentAssessment.classId);
  }, [data.pupils, currentAssessment.classId]);

  // Objectives for this specific assessment
  const currentObjectives = useMemo(() => {
    return data.getObjectivesForAssessment(currentAssessment.id);
  }, [data.objectives, currentAssessment.id]);

  // Evaluations for this specific assessment
  const currentEvaluations = useMemo(() => {
    return data.getEvaluationsForAssessment(currentAssessment.id);
  }, [data.evaluations, currentAssessment.id]);

  // Remediation for this specific assessment
  const currentRemediation = useMemo(() => {
    return data.getRemediationForAssessment(currentAssessment.id);
  }, [data.allRemediations, currentAssessment.id]);

  const [exportingFormat, setExportingFormat] = useState<'excel' | 'docx' | null>(null);

  // Compute column totals for bottom total row
  const objectiveTotals = useMemo(() => {
    return currentObjectives.map((obj) => {
      let plus = 0;
      let plusMinus = 0;
      let minus = 0;
      currentPupils.forEach((pupil) => {
        const val = currentEvaluations[pupil.id]?.[obj.id];
        if (val === 'Acquired') plus++;
        else if (val === 'PartiallyAcquired') plusMinus++;
        else if (val === 'NotAcquired') minus++;
      });
      return { plus, plusMinus, minus };
    });
  }, [currentObjectives, currentPupils, currentEvaluations]);

  // Compute pupil totals
  const pupilTotals = useMemo(() => {
    const map = new Map<string, { plus: number; plusMinus: number; minus: number }>();
    currentPupils.forEach((pupil) => {
      let plus = 0;
      let plusMinus = 0;
      let minus = 0;
      currentObjectives.forEach((obj) => {
        const val = currentEvaluations[pupil.id]?.[obj.id];
        if (val === 'Acquired') plus++;
        else if (val === 'PartiallyAcquired') plusMinus++;
        else if (val === 'NotAcquired') minus++;
      });
      map.set(pupil.id, { plus, plusMinus, minus });
    });
    return map;
  }, [currentPupils, currentObjectives, currentEvaluations]);

  const grandTotals = useMemo(() => {
    let plus = 0;
    let plusMinus = 0;
    let minus = 0;
    pupilTotals.forEach((t) => {
      plus += t.plus;
      plusMinus += t.plusMinus;
      minus += t.minus;
    });
    return { plus, plusMinus, minus };
  }, [pupilTotals]);

  const exportPayload = useMemo<AssessmentExportData>(() => {
    return {
      school: data.school,
      teacherName: data.teacherName,
      level: currentClass.level,
      className: currentClass.name,
      academicYear: currentClass.academicYear,
      assessment: currentAssessment,
      objectives: currentObjectives,
      pupils: currentPupils,
      evaluations: currentEvaluations,
      individualRemediation: currentRemediation.individual,
      classRemediation: currentRemediation.classroom,
    };
  }, [
    data.school,
    data.teacherName,
    currentClass,
    currentAssessment,
    currentObjectives,
    currentPupils,
    currentEvaluations,
    currentRemediation,
  ]);

  const handleExportExcel = async () => {
    try {
      setExportingFormat('excel');
      const csvData = generateAssessmentExcel(exportPayload);
      const filename = `Evaluation_${currentClass.name.replace(/\s+/g, '_')}_${currentAssessment.competency.replace(/\s+/g, '_')}_${currentAssessment.date.replace(/[/\\:]/g, '-')}.csv`;
      await downloadFile(
        csvData,
        filename,
        'text/csv;charset=utf-8',
      );
    } catch (error) {
      console.error('Erreur export CSV:', error);
      Alert.alert('Erreur', 'Impossible de générer le fichier CSV.');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportWord = async () => {
    try {
      setExportingFormat('docx');
      const blob = await generateAssessmentDocx(exportPayload);
      const filename = `Evaluation_${currentClass.name.replace(/\s+/g, '_')}_${currentAssessment.competency.replace(/\s+/g, '_')}_${currentAssessment.date.replace(/[/\\:]/g, '-')}.docx`;
      await downloadFile(
        blob,
        filename,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    } catch (error) {
      console.error('Erreur export Word:', error);
      Alert.alert('Erreur', 'Impossible de générer le document Word.');
    } finally {
      setExportingFormat(null);
    }
  };

  const printReport = async () => {
    try {
      await exportAssessmentPdf(exportPayload);
    } catch (error) {
      console.error('Erreur impression/PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le document PDF.');
    }
  };

  const shareReport = async () => {
    try {
      const summaryText = `${data.school.name} - ${currentAssessment.title}\nClasse : ${currentClass.name}\nCompétence : ${currentAssessment.competency}`;
      await Share.share({ title: `Évaluation — ${currentClass.name}`, message: summaryText });
    } catch {
      Alert.alert('Partage impossible', 'Le rapport reste disponible dans cet aperçu.');
    }
  };

  return (
    <Screen>
      <AppHeader
        eyebrow={`${currentClass.name} · ${currentAssessment.competency}`}
        title="Document d’évaluation"
        onBack={() => router.back()}
      />

      {/* Top Action Toolbar */}
      <View style={styles.actionsBar}>
        <View style={styles.primaryButtons}>
          <Button
            label={exportingFormat === 'excel' ? 'Génération CSV…' : 'Exporter CSV (.csv)'}
            icon={exportingFormat === 'excel' ? 'loader' : 'file-text'}
            onPress={handleExportExcel}
            disabled={exportingFormat !== null}
          />
          <Button
            label={exportingFormat === 'docx' ? 'Génération Word…' : 'Exporter Word (.docx)'}
            icon={exportingFormat === 'docx' ? 'loader' : 'file'}
            onPress={handleExportWord}
            disabled={exportingFormat !== null}
          />
        </View>
        <View style={styles.secondaryButtons}>
          <Button label="Imprimer / PDF" icon="printer" secondary onPress={printReport} />
          <Button label="Partager" icon="share-2" secondary onPress={shareReport} />
        </View>
      </View>

      {exportingFormat && (
        <Surface style={styles.loadingBanner}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.foreground }]}>
          Préparation du fichier {exportingFormat === 'excel' ? 'CSV (.csv)' : 'Word (.docx)'} en cours…
          </Text>
        </Surface>
      )}

      {/* The Printable Document Container */}
      <Surface style={[styles.sheet, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}>
        {/* Document Header */}
        <Text style={styles.docHeaderLine1}>
          Établissement : <Text style={styles.bold}>{data.school.name || '—'}</Text> | Niveau :{' '}
          <Text style={styles.bold}>{currentClass.level || '—'}</Text>
          {data.teacherName ? (
            <>
              {' '}| Enseignant(e) : <Text style={styles.bold}>{data.teacherName}</Text>
            </>
          ) : null}
        </Text>

        <Text style={styles.docHeaderLine2}>
          <Text style={styles.bold}>Compétence : </Text>
          {currentAssessment.competency} |{' '}
          <Text style={styles.bold}>Objectif de la séance : </Text>
          {currentAssessment.sessionObjectives || 'Objectifs de la séance'} |{' '}
          <Text style={styles.bold}>Support : </Text>
          {currentAssessment.support || 'Support pédagogique'}
        </Text>

        {/* Objectives Section */}
        <Text style={styles.objectivesHeading}>
          Objectifs d’évaluation ({currentObjectives.length} Objectifs) :
        </Text>
        <View style={styles.objectivesList}>
          {currentObjectives.map((obj, index) => (
            <View key={obj.id} style={styles.objectiveItem}>
              <Text style={styles.objectiveOrder}>{String(obj.order || index + 1).padStart(2, '0')}. </Text>
              <Text style={styles.objectiveText}>{obj.description}</Text>
            </View>
          ))}
        </View>

        {/* Results Grid Section Title */}
        <Text style={styles.gridTitle}>
          Grille d’analyse des résultats — Classe : {currentClass.name}
        </Text>

        {/* Scrollable Table Container */}
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
          <View style={styles.tableContainer}>
            {/* Table Header Row 1 */}
            <View style={styles.headerRow1}>
              <View style={[styles.thCell, styles.colNum, styles.cellR1to3]}>
                <Text style={styles.thText}>N°</Text>
              </View>
              <View style={[styles.thCell, styles.colName, styles.cellR1to3]}>
                <Text style={styles.thText}>Nom et Prénom</Text>
              </View>
              <View
                style={[
                  styles.thCell,
                  { width: Math.max(currentObjectives.length * 66, 66) },
                ]}
              >
                <Text style={[styles.thText, styles.thGroupText]}>Objectifs d’évaluation</Text>
              </View>
              <View style={[styles.thCell, styles.colTotalGroup, styles.cellR1to2]}>
                <Text style={styles.thText}>Total</Text>
              </View>
            </View>

            {/* Table Header Row 2 */}
            <View style={styles.headerRow2}>
              <View style={[styles.colNum, styles.hiddenPlaceholder]} />
              <View style={[styles.colName, styles.hiddenPlaceholder]} />
              <View style={styles.objectivesRow2Group}>
                {currentObjectives.map((obj, idx) => (
                  <View key={obj.id} style={styles.objNumCol}>
                    <Text style={styles.thText}>{String(obj.order || idx + 1).padStart(2, '0')}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.colTotalGroup, styles.hiddenPlaceholder]} />
            </View>

            {/* Table Header Row 3 */}
            <View style={styles.headerRow3}>
              <View style={[styles.colNum, styles.hiddenPlaceholder]} />
              <View style={[styles.colName, styles.hiddenPlaceholder]} />
              <View style={styles.objectivesRow3Group}>
                {currentObjectives.map((obj) => (
                  <View key={obj.id} style={styles.objSubcolsGroup}>
                    <View style={styles.subcolCell}>
                      <Text style={styles.subcolText}>+</Text>
                    </View>
                    <View style={styles.subcolCell}>
                      <Text style={styles.subcolText}>±</Text>
                    </View>
                    <View style={styles.subcolCell}>
                      <Text style={styles.subcolText}>-</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.totalSubcolsGroup}>
                <View style={styles.totalSubcolCell}>
                  <Text style={styles.subcolText}>+</Text>
                </View>
                <View style={styles.totalSubcolCell}>
                  <Text style={styles.subcolText}>±</Text>
                </View>
                <View style={styles.totalSubcolCell}>
                  <Text style={styles.subcolText}>-</Text>
                </View>
              </View>
            </View>

            {/* Pupil Rows */}
            {currentPupils.map((pupil, index) => {
              const regNo = pupil.registrationNumber || String(index + 1).padStart(2, '0');
              const totals = pupilTotals.get(pupil.id) ?? { plus: 0, plusMinus: 0, minus: 0 };
              const isAlt = index % 2 === 1;

              return (
                <View
                  key={pupil.id}
                  style={[styles.pupilRow, { backgroundColor: isAlt ? '#F8FAFC' : '#FFFFFF' }]}
                >
                  <View style={[styles.cell, styles.colNum]}>
                    <Text style={styles.regNoText}>{regNo}</Text>
                  </View>
                  <View style={[styles.cell, styles.colName, styles.leftAlign]}>
                    <Text style={styles.pupilNameText} numberOfLines={1}>
                      {pupil.lastName} {pupil.firstName}
                    </Text>
                  </View>

                  <View style={styles.objectivesRow3Group}>
                    {currentObjectives.map((obj) => {
                      const val = currentEvaluations[pupil.id]?.[obj.id];
                      return (
                        <View key={obj.id} style={styles.objSubcolsGroup}>
                          <View style={styles.subcolCell}>
                            <Text style={styles.markText}>{val === 'Acquired' ? '+' : ''}</Text>
                          </View>
                          <View style={styles.subcolCell}>
                            <Text style={styles.markText}>{val === 'PartiallyAcquired' ? '±' : ''}</Text>
                          </View>
                          <View style={styles.subcolCell}>
                            <Text style={styles.markText}>{val === 'NotAcquired' ? '-' : ''}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Pupil Totals */}
                  <View style={styles.totalSubcolsGroup}>
                    <View style={styles.totalSubcolCell}>
                      <Text style={styles.pupilTotalText}>{totals.plus > 0 ? totals.plus : ''}</Text>
                    </View>
                    <View style={styles.totalSubcolCell}>
                      <Text style={styles.pupilTotalText}>
                        {totals.plusMinus > 0 ? totals.plusMinus : ''}
                      </Text>
                    </View>
                    <View style={styles.totalSubcolCell}>
                      <Text style={styles.pupilTotalText}>{totals.minus > 0 ? totals.minus : ''}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Bottom Total Row */}
            <View style={styles.bottomTotalRow}>
              <View style={[styles.cell, styles.colTotalLabel]}>
                <Text style={styles.bottomTotalLabelText}>Total</Text>
              </View>

              <View style={styles.objectivesRow3Group}>
                {objectiveTotals.map((tot, idx) => (
                  <View key={idx} style={styles.objSubcolsGroup}>
                    <View style={styles.subcolCell}>
                      <Text style={styles.bottomTotalNumText}>{tot.plus > 0 ? tot.plus : ''}</Text>
                    </View>
                    <View style={styles.subcolCell}>
                      <Text style={styles.bottomTotalNumText}>
                        {tot.plusMinus > 0 ? tot.plusMinus : ''}
                      </Text>
                    </View>
                    <View style={styles.subcolCell}>
                      <Text style={styles.bottomTotalNumText}>{tot.minus > 0 ? tot.minus : ''}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.totalSubcolsGroup}>
                <View style={styles.totalSubcolCell}>
                  <Text style={styles.bottomTotalNumText}>
                    {grandTotals.plus > 0 ? grandTotals.plus : ''}
                  </Text>
                </View>
                <View style={styles.totalSubcolCell}>
                  <Text style={styles.bottomTotalNumText}>
                    {grandTotals.plusMinus > 0 ? grandTotals.plusMinus : ''}
                  </Text>
                </View>
                <View style={styles.totalSubcolCell}>
                  <Text style={styles.bottomTotalNumText}>
                    {grandTotals.minus > 0 ? grandTotals.minus : ''}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Post-Table Remediation Section */}
        <View style={styles.decisionsSection}>
          <Text style={styles.decisionsTitle}>Décisions à prendre :</Text>

          <Text style={styles.decisionCategory}>A) Au plan individuel :</Text>
          {(currentRemediation.individual || 'Aucune décision individuelle enregistrée.')
            .split('\n')
            .filter(Boolean)
            .map((line, idx) => (
              <Text key={idx} style={styles.decisionBullet}>
                {line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`}
              </Text>
            ))}

          <Text style={styles.decisionCategory}>B) Au plan de la classe :</Text>
          {(currentRemediation.classroom || 'Aucune décision de classe enregistrée.')
            .split('\n')
            .filter(Boolean)
            .map((line, idx) => (
              <Text key={idx} style={styles.decisionBullet}>
                {line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`}
              </Text>
            ))}
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  primaryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sheet: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 24,
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  docHeaderLine1: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F4E78',
    marginBottom: 6,
  },
  docHeaderLine2: {
    fontSize: 11.5,
    color: '#333333',
    lineHeight: 18,
    marginBottom: 14,
  },
  bold: {
    fontWeight: '700',
  },
  objectivesHeading: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1F4E78',
    marginBottom: 6,
  },
  objectivesList: {
    gap: 3,
    marginBottom: 16,
    paddingLeft: 4,
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  objectiveOrder: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F4E78',
    width: 24,
  },
  objectiveText: {
    fontSize: 11,
    color: '#333333',
    flex: 1,
    lineHeight: 16,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F4E78',
    marginBottom: 10,
    marginTop: 6,
  },
  tableScroll: {
    paddingBottom: 8,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#7F7F7F',
  },
  colNum: {
    width: 38,
  },
  colName: {
    width: 190,
  },
  colTotalLabel: {
    width: 228,
  },
  objNumCol: {
    width: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#7F7F7F',
    backgroundColor: '#E9EEF4',
  },
  colTotalGroup: {
    width: 81,
  },
  objectivesRow2Group: {
    flexDirection: 'row',
  },
  objectivesRow3Group: {
    flexDirection: 'row',
  },
  objSubcolsGroup: {
    flexDirection: 'row',
    width: 66,
    borderRightWidth: 1,
    borderColor: '#7F7F7F',
  },
  subcolCell: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 22,
  },
  totalSubcolsGroup: {
    flexDirection: 'row',
    width: 81,
  },
  totalSubcolCell: {
    width: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 22,
  },
  headerRow1: {
    flexDirection: 'row',
    minHeight: 26,
    backgroundColor: '#D9E1F2',
    borderBottomWidth: 1,
    borderColor: '#7F7F7F',
  },
  headerRow2: {
    flexDirection: 'row',
    minHeight: 22,
    borderBottomWidth: 1,
    borderColor: '#7F7F7F',
    backgroundColor: '#E9EEF4',
  },
  headerRow3: {
    flexDirection: 'row',
    minHeight: 20,
    borderBottomWidth: 1,
    borderColor: '#7F7F7F',
    backgroundColor: '#E9EEF4',
  },
  pupilRow: {
    flexDirection: 'row',
    minHeight: 24,
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  bottomTotalRow: {
    flexDirection: 'row',
    minHeight: 26,
    backgroundColor: '#D9E1F2',
    borderTopWidth: 1,
    borderColor: '#7F7F7F',
    alignItems: 'center',
  },
  thCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#7F7F7F',
  },
  thText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  thGroupText: {
    fontSize: 11,
  },
  cellR1to3: {
    backgroundColor: '#E9EEF4',
  },
  cellR1to2: {
    backgroundColor: '#D9E1F2',
  },
  hiddenPlaceholder: {
    borderRightWidth: 1,
    borderColor: '#7F7F7F',
    backgroundColor: '#E9EEF4',
  },
  subcolText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333333',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#7F7F7F',
    minHeight: 24,
  },
  leftAlign: {
    alignItems: 'flex-start',
    paddingHorizontal: 6,
  },
  regNoText: {
    fontSize: 10,
    color: '#333333',
  },
  pupilNameText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#111827',
  },
  markText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  pupilTotalText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#111827',
  },
  bottomTotalLabelText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
  },
  bottomTotalNumText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  decisionsSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  decisionsTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1F4E78',
    marginBottom: 6,
  },
  decisionCategory: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
  },
  decisionBullet: {
    fontSize: 10.5,
    lineHeight: 16,
    color: '#333333',
    marginLeft: 8,
    marginBottom: 3,
  },
});
