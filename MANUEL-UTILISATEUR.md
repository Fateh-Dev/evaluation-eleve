# Manuel utilisateur — Évaluation Élève

Ce guide présente les principaux parcours de l’application et où trouver chaque fonctionnalité. Les intitulés peuvent varier légèrement selon la version ou la plateforme.

## Sommaire

- [Bien démarrer](#bien-démarrer)
- [Repères de navigation](#repères-de-navigation)
- [Créer une classe et ajouter des élèves](#créer-une-classe-et-ajouter-des-élèves)
- [Faire un test de niveau initial](#faire-un-test-de-niveau-initial)
- [Suivre les évaluations par trimestre](#suivre-les-évaluations-par-trimestre)
- [Faire l’appel](#faire-lappel)
- [Gérer l’emploi du temps](#gérer-lemploi-du-temps)
- [Consulter les statistiques et exporter](#consulter-les-statistiques-et-exporter)
- [Gérer les documents pédagogiques](#gérer-les-documents-pédagogiques)
- [Configurer, sauvegarder et protéger les données](#configurer-sauvegarder-et-protéger-les-données)
- [Données de démonstration et réinitialisation](#données-de-démonstration-et-réinitialisation)
- [Fonctionnalités qui ne sont pas encore disponibles](#fonctionnalités-qui-ne-sont-pas-encore-disponibles)

## Bien démarrer

À la première ouverture, suivez l’écran de configuration initiale pour renseigner le nom de l’enseignant et, si vous le souhaitez, les informations de l’établissement. Ces informations personnalisent notamment les documents exportés.

Ordre conseillé pour commencer :

1. Vérifier l’année scolaire et la configuration pédagogique.
2. Créer les classes.
3. Ajouter ou importer les élèves.
4. Configurer les périodes trimestrielles et l’emploi du temps.
5. Saisir le test de niveau initial, les évaluations continues et les présences.
6. Consulter les statistiques et exporter les documents nécessaires.

## Repères de navigation

La barre de navigation principale donne accès à :

- **Accueil** : classe active, aperçu du suivi et raccourcis liés à la journée.
- **Classes** : créer et consulter les classes, leurs élèves et leurs données.
- **Suivi** : périodes trimestrielles, évaluation continue et accès au test de niveau initial.
- **Plus** : guide d’utilisation, emploi du temps, fin d’année scolaire, recherche d’élèves et de classes, statistiques, bilans trimestriels, documents pédagogiques et paramètres.

Dans **Plus**, utilisez la recherche pour retrouver rapidement une classe par son nom ou un élève par son nom ou son matricule.

Pour obtenir les étapes d’une action directement dans l’application, ouvrez **Plus → Guide d’utilisation**. Recherchez une tâche (par exemple « faire l’appel » ou « sauvegarde »), dépliez son guide, puis appuyez sur le bouton pour ouvrir l’écran correspondant.

## Mode quotidien

Pour alléger l’accueil, ouvrez **Plus → Paramètres de l’application → Interface** et activez **Mode quotidien**. La section **Programme** affiche les séances du jour dans l’ordre, avec la classe en cours et la suivante ; utilisez **Consulter** pour ouvrir l’emploi du temps complet ou touchez une séance pour ouvrir sa classe. La **classe choisie** reste indépendante du programme : pendant une séance, l’appel et l’évaluation continue ciblent la classe en cours ; hors séance, ils utilisent la classe choisie. Si aucun cours n’est prévu aujourd’hui pour cette classe, le raccourci d’appel propose d’ouvrir l’emploi du temps. La section **États de sortie** imprime en PDF les présences et absences avec leurs dates pour la période active, les résultats continus de cette période, ou l’emploi du temps hebdomadaire de l’année active. Appuyez sur **Mode complet** sur l’accueil, ou désactivez le commutateur dans les paramètres, pour revenir au tableau de bord détaillé. Le choix est mémorisé sur l’appareil.

## Créer une classe et ajouter des élèves

1. Ouvrir **Classes**.
2. Appuyer sur **Ajouter une classe**.
3. Saisir le nom, choisir l’année scolaire et le niveau, puis valider.
4. Ouvrir la classe créée.
5. Ajouter les élèves un par un, ou choisir **Importer des élèves (CSV/Texte)**.

Pour l’import, collez une ligne par élève avec trois champs séparés par un point-virgule ou une virgule :

```text
Matricule;Prénom;Nom
25;Nadia;Khelifi
26;Karim;Belaïd
```

Vérifiez l’aperçu et le nombre de lignes valides avant d’appuyer sur **Importer**. Les doublons détectés sont ignorés. Dans une classe, sélectionnez un élève pour ouvrir sa fiche.

## Faire un test de niveau initial

1. Ouvrir **Suivi**.
2. Appuyer sur **Test de niveau initial**.
3. Choisir la classe, puis ajouter une compétence au test.
4. Vérifier le titre, la date, le support et les objectifs proposés; les adapter si nécessaire.
5. Ouvrir l’évaluation créée et renseigner les résultats des élèves pour chaque objectif.
6. Consulter l’analyse ou exporter le document depuis les actions de l’évaluation.

Le test initial sert à repérer les acquis de départ. Les compétences disponibles et leurs objectifs dépendent de la configuration pédagogique du niveau de la classe.

## Suivre les évaluations par trimestre

Dans **Suivi**, choisissez l’année scolaire, puis la période à consulter. Les résultats sont conservés séparément pour chaque période.

- Utilisez **Ajouter une période** pour créer un trimestre avec son nom, sa date de début et sa date de fin.
- Sélectionnez une période pour la rendre active.
- Ouvrez la classe concernée et utilisez les champs de suivi continu pour saisir les notes de cahier et de participation.
- Les données de discipline et d’absence alimentent aussi le suivi et les statistiques.

Les périodes d’une même année ne doivent pas se chevaucher. Les dates sont utilisées pour filtrer les résultats.

## Faire l’appel

Deux raccourcis sont disponibles :

- Depuis **Accueil**, ouvrir l’action d’appel de la séance en cours lorsqu’elle est affichée.
- Ouvrir **Classes**, choisir la classe, puis **Présences / Appel**.

Choisissez la date et la séance programmée. Indiquez **présent** ou **absent** pour chaque élève, puis enregistrez l’appel. Un appel incomplet ou une date future ne peut pas être enregistré. La page d’appel permet également d’exporter un PDF.

## Gérer l’emploi du temps

1. Ouvrir **Plus → Emploi du temps**.
2. Utiliser les flèches ou les onglets de semaine pour parcourir le planning. La semaine commence le dimanche.
3. Ajouter ou modifier une séance récurrente en choisissant le jour, les heures et la classe.
4. Ouvrir une occurrence pour l’annuler avec un motif, ou la reporter à une autre date, heure ou classe.
5. Utiliser l’action de séance ponctuelle pour ajouter un cours exceptionnel.
6. Appuyer sur **Exporter PDF** pour partager ou imprimer le planning.

Une séance récurrente décrit le créneau habituel; une annulation ou un report modifie uniquement l’occurrence concernée, pas les semaines suivantes.

## Consulter les statistiques et exporter

1. Ouvrir **Plus → Statistiques multicritères**.
2. Choisir une classe, une période, un élève, un critère/compétence et un type d’évaluation.
3. Replier ou déplier la zone des critères si nécessaire.
4. Lire les résultats filtrés, puis appuyer sur **Exporter les résultats (CSV)** pour les exploiter dans un tableur.

Pour obtenir un document lié à une évaluation précise, ouvrez cette évaluation et utilisez ses actions d’analyse ou d’export. Les exports disponibles dépendent du type d’écran : par exemple PDF pour l’appel et le planning, CSV pour les statistiques.

### Imprimer un bilan trimestriel

1. Ouvrir **Plus → Bilans trimestriels**.
2. Choisir la classe et le trimestre.
3. Choisir **Toute la classe** pour produire un document avec un bilan par élève, ou sélectionner un élève pour son bilan individuel.
4. Vérifier l’aperçu, puis appuyer sur **Imprimer les bilans de la classe** ou **Imprimer le bilan de l’élève**.

Le PDF rassemble les évaluations du trimestre, les résultats par compétence, le cahier, la participation, les présences, les absences et les scores calculés d’absence et de discipline. Les informations non saisies apparaissent comme manquantes plutôt que comme zéro.

## Archiver une année et préparer la suivante

1. Ouvrir **Plus → Fin d’année scolaire**.
2. Choisir l’année à archiver et saisir le libellé de la nouvelle année.
3. Choisir si la configuration pédagogique, les classes et les élèves, et l’emploi du temps récurrent doivent être repris.
4. Vérifier le récapitulatif et confirmer **Archiver et créer la nouvelle année**.

Une seule année est active à la fois. L’année source et ses résultats sont conservés pour consultation; la nouvelle année devient l’année active. Les classes et élèves copiés reçoivent de nouveaux identifiants, et les notes, tests, présences, événements disciplinaires et décisions ne sont pas transférés. Un emploi du temps ne peut être copié que si les classes et les élèves le sont aussi. Activer une autre année archive l’année active précédente. Une année archivée peut être restaurée depuis le même écran.

## Gérer les documents pédagogiques

Ouvrir **Plus → Documents pédagogiques** pour consulter la bibliothèque de PDF de l’application. Depuis l’espace de stockage, il est possible d’ajouter un PDF, de le rechercher, de le renommer, de le supprimer ou de le restaurer depuis la corbeille.

Cette bibliothèque est actuellement personnelle et stockée sur l’appareil; elle n’est pas synchronisée avec les autres utilisateurs.

## Configurer, sauvegarder et protéger les données

Dans **Plus → Configuration pédagogique**, gérez les années, niveaux, compétences et objectifs utilisés lors de la création des évaluations.

Dans **Plus → Paramètres de l’application**, vous pouvez notamment :

- modifier le profil enseignant et les informations de l’établissement;
- régler les rappels et l’apparence;
- créer une sauvegarde complète en JSON ou restaurer une sauvegarde;
- activer ou gérer la protection par code PIN et, si disponible, la biométrie.

Faites une sauvegarde avant toute opération de remplacement ou de suppression importante. Conservez le fichier de sauvegarde dans un emplacement sûr : il contient les données enregistrées dans l’application.

## Données de démonstration et réinitialisation

Ces deux actions se trouvent dans **Paramètres de l’application → Gestion des données**.

- **Générer les données de test** remplace les données pédagogiques existantes par cinq classes, entre 32 et 40 élèves par classe et un planning de 14 heures par semaine. La confirmation précise les données concernées; une sauvegarde automatique est lancée. Le profil enseignant et les informations de l’établissement sont conservés.
- **Réinitialiser l’application** efface les données locales. L’action demande une confirmation renforcée; créez d’abord une sauvegarde si vous souhaitez garder une copie.

N’utilisez pas ces actions sur vos données réelles sans avoir vérifié la confirmation et conservé une sauvegarde.

## Fonctionnalités qui ne sont pas encore disponibles

La bibliothèque de documents pédagogiques reste personnelle et stockée sur l’appareil; elle n’est pas synchronisée ni partagée entre utilisateurs. L’application ne dispose pas non plus de comptes enseignants et de synchronisation cloud.
