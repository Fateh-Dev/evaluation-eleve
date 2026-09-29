import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function NewAssessmentScreen() {
  const colors = useColors();
  const data = useAppData();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Français');
  const [competency, setCompetency] = useState('');
  const [support, setSupport] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('fr-FR'));

  const field = (label: string, value: string, onChangeText: (value: string) => void, placeholder: string) => <View style={styles.field}>
    <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} />
  </View>;

  const create = () => {
    if (!title.trim() || !competency.trim()) {
      Alert.alert('Informations manquantes', 'Le titre et la compétence sont obligatoires.');
      return;
    }
    const assessmentId = data.createAssessment({ title, subject, level: data.level, competency, support, sessionObjectives: '', date });
    router.replace(`/assessments/${assessmentId}`);
  };

  return <Screen>
    <AppHeader eyebrow={`${data.className} · ${data.academicYear}`} title="Nouvelle évaluation" onBack={() => router.back()} />
    <Surface style={styles.form}>
      <SectionTitle title="Informations" />
      {field('TITRE', title, setTitle, 'Ex. Compréhension de l’écrit')}
      {field('MATIÈRE', subject, setSubject, 'Français')}
      {field('COMPÉTENCE', competency, setCompetency, 'Compétence évaluée')}
      {field('SUPPORT', support, setSupport, 'Type de support ou document')}
      {field('DATE', date, setDate, 'JJ/MM/AAAA')}
      <Text style={[styles.help, { color: colors.mutedForeground }]}>Les objectifs existants servent de base à ce brouillon. Vous pourrez les ajuster dans la prochaine étape.</Text>
      <View style={styles.actions}><Button label="Créer le brouillon" icon="check" onPress={create} /><Button label="Annuler" secondary onPress={() => router.back()} /></View>
    </Surface>
  </Screen>;
}

const styles = StyleSheet.create({
  form: { gap: 9 },
  field: { gap: 6 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  help: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  actions: { gap: 9, marginTop: 10 },
});
