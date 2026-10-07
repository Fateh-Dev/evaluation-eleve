import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useColors } from '@/hooks/useColors';

const GUIDE_TOPICS = [
  {
    id: 'start',
    group: 'Premiers pas',
    title: 'Par où commencer ?',
    icon: 'flag' as const,
    keywords: 'démarrer première ouverture enseignant établissement année scolaire',
    intro: 'Configurez votre espace dans cet ordre pour éviter de ressaisir les informations.',
    steps: [
      'Dans Plus → Paramètres de l’application, renseignez le nom de l’enseignant et l’établissement.',
      'Dans Plus → Configuration pédagogique, vérifiez les années, niveaux, compétences et objectifs.',
      'Dans Classes, créez vos classes puis ajoutez ou importez les élèves.',
      'Dans Suivi, définissez les trimestres. Dans Plus → Emploi du temps, ajoutez les séances.',
    ],
    route: '/settings',
    action: 'Ouvrir les paramètres',
  },
  {
    id: 'classes',
    group: 'Classes et élèves',
    title: 'Créer une classe',
    icon: 'users' as const,
    keywords: 'ajouter classe niveau année scolaire créer',
    intro: 'Une classe est rattachée à un niveau et à une année scolaire.',
    steps: [
      'Ouvrez Classes puis appuyez sur Ajouter une classe.',
      'Saisissez son nom, choisissez l’année scolaire et le niveau, puis validez.',
      'Ouvrez la classe pour ajouter des élèves ou importer une liste.',
    ],
    route: '/(tabs)/classes',
    action: 'Ouvrir les classes',
  },
  {
    id: 'pupils',
    group: 'Classes et élèves',
    title: 'Ajouter ou importer des élèves',
    icon: 'user-plus' as const,
    keywords: 'élèves étudiants importer csv texte matricule nom prénom',
    intro: 'Les élèves se gèrent dans la fiche de leur classe.',
    steps: [
      'Ouvrez Classes, puis choisissez la classe concernée.',
      'Pour une saisie manuelle, utilisez Ajouter un élève.',
      'Pour un import, choisissez Importer des élèves (CSV/Texte), puis collez une ligne par élève.',
      'Séparez matricule, prénom et nom par des points-virgules ou des virgules; contrôlez l’aperçu avant Importer.',
    ],
    detail: 'Exemple : 25;Nadia;Khelifi. Les doublons détectés sont ignorés.',
    route: '/(tabs)/classes',
    action: 'Ouvrir les classes',
  },
  {
    id: 'level-test',
    group: 'Évaluations et suivi',
    title: 'Créer un test de niveau initial',
    icon: 'target' as const,
    keywords: 'test niveau initial compétences diagnostic évaluation départ',
    intro: 'Le test initial permet de repérer les acquis en début d’année.',
    steps: [
      'Ouvrez Suivi puis Test de niveau initial.',
      'Choisissez une classe et ajoutez les compétences à évaluer.',
      'Vérifiez la date, le titre, le support et les objectifs proposés.',
      'Ouvrez le test et renseignez les résultats par élève et par objectif.',
    ],
    route: '/assessments',
    action: 'Ouvrir les tests initiaux',
  },
  {
    id: 'continuous',
    group: 'Évaluations et suivi',
    title: 'Saisir le suivi continu d’un trimestre',
    icon: 'check-square' as const,
    keywords: 'trimestre période cahier participation notes discipline absence suivi continu',
    intro: 'Chaque période conserve ses propres notes de suivi continu.',
    steps: [
      'Ouvrez Suivi et sélectionnez la bonne année scolaire et le trimestre.',
      'Ouvrez Classes, choisissez une classe, puis l’onglet Évaluation continue.',
      'Sélectionnez le trimestre concerné et saisissez les notes de cahier et de participation.',
      'Les données d’absence et de discipline sont utilisées dans les scores calculés.',
    ],
    detail: 'Pour créer ou modifier les dates d’un trimestre, appuyez sur Périodes dans l’écran Suivi.',
    route: '/(tabs)/continuous',
    action: 'Ouvrir le suivi',
  },
  {
    id: 'attendance',
    group: 'Présences',
    title: 'Faire l’appel',
    icon: 'clipboard' as const,
    keywords: 'appel présence absent présent classe séance date',
    intro: 'L’appel est associé à une classe, une séance et une date.',
    steps: [
      'Depuis Accueil, ouvrez l’appel de la séance en cours; ou ouvrez Classes puis la classe concernée.',
      'Appuyez sur Faire l’appel, puis choisissez la date et la séance programmée.',
      'Indiquez présent ou absent pour chaque élève et enregistrez.',
      'Depuis l’écran d’appel, utilisez Exporter PDF si vous souhaitez imprimer la liste.',
    ],
    detail: 'Chaque élève doit avoir un statut. Les appels ne sont pas enregistrables pour une date future.',
    route: '/(tabs)/classes',
    action: 'Choisir une classe',
  },
  {
    id: 'schedule',
    group: 'Organisation',
    title: 'Gérer ou reporter une séance',
    icon: 'calendar' as const,
    keywords: 'emploi du temps séance récurrente ponctuelle annuler reporter déplacer semaine exporter pdf',
    intro: 'Le planning affiche les séances habituelles et les changements ponctuels par semaine.',
    steps: [
      'Ouvrez Plus → Emploi du temps. Les flèches et onglets permettent de changer de semaine.',
      'Ajoutez ou modifiez un créneau récurrent en choisissant le jour, les heures et la classe.',
      'Ouvrez une occurrence pour l’annuler avec un motif ou la reporter à une autre date, heure ou classe.',
      'Utilisez l’action de séance ponctuelle pour ajouter un cours exceptionnel.',
      'Appuyez sur Exporter PDF pour imprimer ou partager le planning.',
    ],
    detail: 'La semaine commence le dimanche. Une annulation ou un report ne modifie que l’occurrence choisie.',
    route: '/schedule',
    action: 'Ouvrir l’emploi du temps',
  },
  {
    id: 'report',
    group: 'Rapports',
    title: 'Imprimer un bilan trimestriel',
    icon: 'file-text' as const,
    keywords: 'bulletin rapport bilan élève classe trimestre pdf imprimer progrès',
    intro: 'Le bilan regroupe les évaluations, le suivi continu et les présences de la période choisie.',
    steps: [
      'Ouvrez Plus → Bilans trimestriels.',
      'Choisissez une classe et un trimestre.',
      'Sélectionnez Toute la classe pour produire une page par élève, ou choisissez un élève.',
      'Vérifiez l’aperçu puis appuyez sur le bouton d’impression du bilan.',
    ],
    detail: 'Les données non renseignées apparaissent comme manquantes. L’impression ouvre les options PDF de l’appareil.',
    route: '/student-reports',
    action: 'Ouvrir les bilans',
  },
  {
    id: 'statistics',
    group: 'Rapports',
    title: 'Filtrer et exporter les statistiques',
    icon: 'bar-chart-2' as const,
    keywords: 'statistiques critères filtre élève classe compétences discipline absence csv exporter',
    intro: 'Les statistiques permettent de croiser les données par classe et période.',
    steps: [
      'Ouvrez Plus → Statistiques multicritères.',
      'Choisissez la classe, la période, l’élève, le critère et le type d’évaluation.',
      'Consultez les résultats filtrés et utilisez Exporter les résultats (CSV) pour un tableur.',
    ],
    route: '/statistics',
    action: 'Ouvrir les statistiques',
  },
  {
    id: 'year-end',
    group: 'Année scolaire',
    title: 'Archiver l’année et préparer la suivante',
    icon: 'archive' as const,
    keywords: 'fin année scolaire archiver transférer reprendre classe élèves horaires année suivante',
    intro: 'L’archivage conserve les résultats de l’année terminée et crée une année de travail distincte.',
    steps: [
      'Ouvrez Plus → Fin d’année scolaire.',
      'Choisissez l’année à archiver et saisissez la nouvelle année.',
      'Cochez les éléments à reprendre : configuration pédagogique, classes et élèves, emploi du temps récurrent.',
      'Relisez la confirmation puis appuyez sur Archiver et créer la nouvelle année.',
    ],
    detail: 'Les évaluations, notes, tests de niveau, présences et événements disciplinaires restent dans l’année archivée. Une année archivée peut être restaurée.',
    route: '/year-end',
    action: 'Ouvrir la fin d’année',
  },
  {
    id: 'backup',
    group: 'Paramètres et protection',
    title: 'Créer ou restaurer une sauvegarde',
    icon: 'download' as const,
    keywords: 'sauvegarde backup json restaurer changer téléphone exporter données sécurité',
    intro: 'Une sauvegarde complète permet de conserver une copie des données de l’application.',
    steps: [
      'Ouvrez Plus → Paramètres de l’application.',
      'Dans Sauvegarde & sécurité, appuyez sur Créer une sauvegarde et choisissez où enregistrer ou partager le JSON.',
      'Pour récupérer une copie, appuyez sur Restaurer et sélectionnez le fichier de sauvegarde.',
      'Vérifiez la date et la provenance du fichier avant de confirmer sa restauration.',
    ],
    detail: 'La restauration remplace l’état local par celui contenu dans la sauvegarde. Faites une copie récente avant de restaurer.',
    route: '/settings',
    action: 'Ouvrir les paramètres',
  },
  {
    id: 'documents',
    group: 'Documents',
    title: 'Ajouter et retrouver un document pédagogique',
    icon: 'folder' as const,
    keywords: 'pdf document fichier bibliothèque stockage partager renommer supprimer',
    intro: 'La bibliothèque permet de retrouver les PDF enregistrés sur cet appareil.',
    steps: [
      'Ouvrez Plus → Documents pédagogiques.',
      'Appuyez sur Ajouter un PDF et choisissez le fichier.',
      'Utilisez la recherche pour retrouver un document; les actions permettent de le renommer ou le supprimer.',
    ],
    detail: 'La bibliothèque est locale à l’appareil et n’est pas partagée ni synchronisée entre utilisateurs.',
    route: '/pdf-library',
    action: 'Ouvrir les documents',
  },
] as const;

const GROUPS = [...new Set(GUIDE_TOPICS.map((topic) => topic.group))];

export default function UserGuideScreen() {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('start');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredTopics = useMemo(
    () => GUIDE_TOPICS.filter((topic) =>
      !normalizedQuery ||
      `${topic.title} ${topic.intro} ${topic.keywords} ${topic.steps.join(' ')} ${'detail' in topic ? topic.detail : ''}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    ),
    [normalizedQuery],
  );

  return (
    <Screen>
      <AppHeader eyebrow="Aide" title="Guide d’utilisation" />
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        Que voulez-vous faire ? Recherchez une action ou ouvrez un guide pas à pas.
      </Text>
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setExpandedId(null);
          }}
          placeholder="Ex. importer des élèves, faire l’appel…"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Rechercher une action dans le guide"
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
            onPress={() => { setQuery(''); setExpandedId('start'); }}
          >
            <Feather name="x" size={17} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {filteredTopics.length ? GROUPS.map((group) => {
        const topics = filteredTopics.filter((topic) => topic.group === group);
        if (!topics.length) return null;
        return (
          <View key={group} style={styles.group}>
            <SectionTitle title={group} />
            {topics.map((topic) => {
              const expanded = expandedId === topic.id;
              return (
                <Surface key={topic.id} style={styles.topic}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => setExpandedId(expanded ? null : topic.id)}
                    style={styles.topicHeader}
                  >
                    <View style={[styles.topicIcon, { backgroundColor: colors.accent }]}>
                      <Feather name={topic.icon} size={17} color={colors.primary} />
                    </View>
                    <Text style={[styles.topicTitle, { color: colors.foreground }]}>{topic.title}</Text>
                    <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                  </Pressable>
                  {expanded ? (
                    <View style={styles.topicContent}>
                      <Text style={[styles.body, { color: colors.mutedForeground }]}>{topic.intro}</Text>
                      {topic.steps.map((step, index) => (
                        <View key={`${topic.id}-${index}`} style={styles.step}>
                          <View style={[styles.stepNumber, { backgroundColor: colors.accent }]}>
                            <Text style={[styles.stepNumberText, { color: colors.primary }]}>{index + 1}</Text>
                          </View>
                          <Text style={[styles.body, styles.stepText, { color: colors.foreground }]}>{step}</Text>
                        </View>
                      ))}
                      {'detail' in topic ? (
                        <Text style={[styles.detail, { color: colors.mutedForeground }]}>{topic.detail}</Text>
                      ) : null}
                      <Button
                        label={topic.action}
                        icon="arrow-right"
                        compact
                        secondary
                        onPress={() => router.push(topic.route)}
                      />
                    </View>
                  ) : null}
                </Surface>
              );
            })}
          </View>
        );
      }) : (
        <Surface style={styles.empty}>
          <Feather name="search" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Aucune action trouvée</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>Essayez un autre mot, par exemple « classe », « trimestre », « PDF » ou « sauvegarde ».</Text>
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  searchInput: { flex: 1, minHeight: 42, fontSize: 13 },
  group: { gap: 12, marginTop: 10 },
  topic: { paddingVertical: 11, gap: 12 },
  topicHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  topicTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  topicContent: { gap: 11, paddingLeft: 2 },
  body: { fontSize: 12, lineHeight: 18 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1, paddingTop: 1 },
  detail: { fontSize: 11, lineHeight: 17, fontStyle: 'italic' },
  empty: { alignItems: 'center', gap: 8, padding: 18 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
});
