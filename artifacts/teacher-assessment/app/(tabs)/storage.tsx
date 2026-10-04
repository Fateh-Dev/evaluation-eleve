import { Alert } from "@/components/AppDialog";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AppHeader,
  Button,
  KeyboardAvoidingViewCompat,
  ListSelectionToolbar,
  Screen,
  SectionTitle,
  SelectionCheckbox,
  Surface,
} from "@/components/AppShell";
import { useColors } from "@/hooks/useColors";
import { useStorage } from "@/context/StorageContext";
import { useListSelection } from "@/hooks/useListSelection";

function formatSize(size?: number) {
  if (!size) return "Taille inconnue";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}
function formatBytes(size: number | null) {
  if (size === null) return "indisponible";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function StorageScreen() {
  const colors = useColors();
  const storage = useStorage();
  const selection = useListSelection();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"date" | "name" | "size">("date");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [emptyTrashArmed, setEmptyTrashArmed] = useState(false);
  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const result = normalizedQuery
      ? storage.files.filter((file) =>
          file.name.toLocaleLowerCase().includes(normalizedQuery),
        )
      : [...storage.files];
    return result.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "size"
          ? (b.size ?? 0) - (a.size ?? 0)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [query, sort, storage.files]);

  const handleUpload = async () => {
    try {
      await storage.uploadPdf();
    } catch (error) {
      Alert.alert(
        "Import impossible",
        error instanceof Error
          ? error.message
          : "Le fichier PDF n’a pas pu être ajouté au stockage.",
      );
    }
  };
  const handleDeleteSelectedFiles = () => {
    const selected = storage.files.filter((file) => selection.selectedIds.includes(file.id));
    if (selected.length === 0) return;
    Alert.alert(
      "Supprimer les PDF sélectionnés ?",
      `${selected.length} document${selected.length > 1 ? "s" : ""} sera${selected.length > 1 ? "ont" : ""} déplacé${selected.length > 1 ? "s" : ""} dans la corbeille.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            selected.forEach((file) => { void storage.deletePdf(file); });
            selection.cancelSelection();
          },
        },
      ],
    );
  };
  const saveRename = async () => {
    const file = storage.files.find((item) => item.id === renameTarget);
    if (!file || !renameInput.trim()) return;
    try {
      await storage.renamePdf(file, renameInput);
      setRenameTarget(null);
    } catch (error) {
      Alert.alert(
        "Renommage impossible",
        error instanceof Error ? error.message : "Erreur de fichier.",
      );
    }
  };

  return (
    <Screen onTouchStart={() => setEmptyTrashArmed(false)}>
      <AppHeader eyebrow="Documents de l’enseignant" title="Stockage" />
      <Surface style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.accent }]}>
          <Feather name="folder" size={25} color={colors.primary} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Ma bibliothèque PDF
          </Text>
          <Text style={[styles.heroText, { color: colors.mutedForeground }]}>
            Ajoutez vos cours, fiches et documents pédagogiques pour les
            retrouver rapidement hors connexion.
          </Text>
        </View>
        <Button
          label="Ajouter un PDF"
          icon="upload"
          compact
          onPress={() => {
            void handleUpload();
          }}
        />
        <Text
          style={[
            styles.usage,
            {
              color: storage.lowSpace
                ? colors.errorForeground
                : colors.mutedForeground,
            },
          ]}
        >
          Utilisé : {formatBytes(storage.usageBytes)} · Disponible :{" "}
          {formatBytes(storage.availableBytes)}
        </Text>
      </Surface>
      {storage.lowSpace ? (
        <Surface
          style={[styles.warning, { backgroundColor: colors.errorSurface }]}
        >
          <Feather
            name="alert-triangle"
            size={17}
            color={colors.errorForeground}
          />
          <Text style={[styles.warningText, { color: colors.errorForeground }]}>
            Le téléphone manque d’espace. Libérez de l’espace avant d’ajouter
            des documents.
          </Text>
        </Surface>
      ) : null}
      <SectionTitle title={`Documents (${storage.files.length})`} />
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un document PDF…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")}>
            <Feather name="x-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() =>
          setSort(sort === "date" ? "name" : sort === "name" ? "size" : "date")
        }
        style={[
          styles.sortButton,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <Feather name="filter" size={15} color={colors.primary} />
        <Text style={[styles.sortText, { color: colors.foreground }]}>
          Tri :{" "}
          {sort === "date" ? "plus récent" : sort === "name" ? "nom" : "taille"}
        </Text>
      </Pressable>
      {storage.files.length > 0 ? (
        <ListSelectionToolbar
          active={selection.isSelecting}
          selectedCount={selection.selectedIds.length}
          onStart={() => selection.startSelecting()}
          onCancel={selection.cancelSelection}
          onDelete={handleDeleteSelectedFiles}
        />
      ) : null}
      {filteredFiles.length === 0 ? (
        <Surface style={styles.empty}>
          <Feather
            name={query ? "search" : "file-text"}
            size={34}
            color={colors.mutedForeground}
          />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {query ? "Aucun document trouvé" : "Aucun PDF enregistré"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {query
              ? "Essayez un autre nom de fichier."
              : "Ajoutez votre premier PDF pour constituer votre bibliothèque pédagogique."}
          </Text>
          {!query ? (
            <Button
              label="Ajouter un PDF"
              compact
              icon="plus"
              onPress={() => {
                void handleUpload();
              }}
            />
          ) : null}
        </Surface>
      ) : (
        <View style={styles.list}>
          {filteredFiles.map((file) => (
            <Surface
              key={file.id}
              style={[
                styles.fileCard,
                selection.selectedIds.includes(file.id) && {
                  backgroundColor: colors.card,
                  borderColor: colors.destructive,
                  borderWidth: 2,
                },
              ]}
            >
              <View
                style={[
                  styles.fileIcon,
                  { backgroundColor: colors.errorSurface },
                ]}
              >
                <Feather
                  name="file-text"
                  size={21}
                  color={colors.errorForeground}
                />
              </View>
              <View style={styles.fileCopy}>
                <Pressable
                  onTouchStart={(event) => event.stopPropagation()}
                  onPress={() => {
                    if (selection.isSelecting) selection.toggleSelection(file.id);
                  }}
                  accessibilityHint={selection.isSelecting ? 'Touchez pour sélectionner ce PDF.' : undefined}
                >
                  <Text numberOfLines={2} style={[styles.fileName, { color: colors.foreground }]}>{file.name}</Text>
                </Pressable>
                <Text
                  style={[styles.fileMeta, { color: colors.mutedForeground }]}
                >
                  {formatSize(file.size)} ·{" "}
                  {new Date(file.createdAt).toLocaleDateString("fr-FR")}
                </Text>
              </View>
                {selection.isSelecting ? (
                  <SelectionCheckbox checked={selection.selectedIds.includes(file.id)} />
                ) : (
                  <>
              <Pressable
                onPress={() => {
                  void storage
                    .openPdf(file)
                    .catch((error) =>
                      Alert.alert(
                        "PDF indisponible",
                        error instanceof Error
                          ? error.message
                          : "Fichier illisible.",
                      ),
                    );
                }}
                style={[styles.action, { backgroundColor: colors.accent }]}
              >
                <Feather
                  name="external-link"
                  size={17}
                  color={colors.primary}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  setRenameTarget(file.id);
                  setRenameInput(file.name.replace(/\.pdf$/i, ""));
                }}
                style={[styles.action, { backgroundColor: colors.secondary }]}
              >
                <Feather name="edit-2" size={16} color={colors.foreground} />
              </Pressable>
                </>
              )}
            </Surface>
          ))}
        </View>
      )}
      {storage.trash.length > 0 ? (
        <Surface
          style={[
            styles.trash,
            emptyTrashArmed && {
              backgroundColor: colors.card,
              borderColor: colors.destructive,
              borderWidth: 2,
            },
          ]}
        >
          <View style={styles.trashHeader}>
            <Text
              onLongPress={() => setEmptyTrashArmed(true)}
              accessibilityHint="Maintenez appuyé pour afficher l’action de vidage."
              style={[styles.trashTitle, { color: colors.foreground }]}
            >
              Corbeille ({storage.trash.length})
            </Text>
            {emptyTrashArmed ? (
              <Button
                label="Vider"
                compact
                secondary
                icon="trash-2"
                onTouchStart={(event) => event.stopPropagation()}
                onPress={() => {
                  setEmptyTrashArmed(false);
                  Alert.alert(
                  "Vider la corbeille ?",
                  "Les fichiers seront définitivement supprimés.",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Supprimer",
                      style: "destructive",
                      onPress: () => {
                        void storage.emptyTrash();
                      },
                    },
                  ],
                  );
                }}
              />
            ) : null}
          </View>
          {storage.trash.map((file) => (
            <View key={file.id} style={styles.trashRow}>
              <Text
                numberOfLines={1}
                style={[styles.trashName, { color: colors.mutedForeground }]}
              >
                {file.name}
              </Text>
              <Pressable
                onPress={() => {
                  void storage
                    .restorePdf(file)
                    .catch((error) =>
                      Alert.alert(
                        "Restauration impossible",
                        error instanceof Error
                          ? error.message
                          : "Fichier indisponible.",
                      ),
                    );
                }}
              >
                <Text style={[styles.restore, { color: colors.primary }]}>
                  Restaurer
                </Text>
              </Pressable>
            </View>
          ))}
        </Surface>
      ) : null}
      <Modal
        visible={Boolean(renameTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalBackdrop}>
          <Surface style={styles.renameModal}>
            <Text style={[styles.renameTitle, { color: colors.foreground }]}>
              Renommer le PDF
            </Text>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              placeholder="Nom du document"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.renameInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <View style={styles.buttonRow}>
              <Button
                label="Enregistrer"
                compact
                onPress={() => {
                  void saveRename();
                }}
              />
              <Button
                label="Annuler"
                compact
                secondary
                onPress={() => setRenameTarget(null)}
              />
            </View>
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 13, padding: 16, marginBottom: 8 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { gap: 4 },
  heroTitle: { fontSize: 18, fontWeight: "800" },
  heroText: { fontSize: 13, lineHeight: 19 },
  usage: { fontSize: 11, fontWeight: "600" },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  searchBox: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  sortButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  sortText: { fontSize: 12, fontWeight: "700" },
  list: { gap: 10, paddingBottom: 24 },
  fileCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13 },
  fileIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  fileCopy: { flex: 1, gap: 4 },
  fileName: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  fileMeta: { fontSize: 11 },
  action: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 34,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 4,
  },
  trash: { gap: 9, padding: 14, marginTop: 14, marginBottom: 24 },
  trashHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trashTitle: { fontSize: 15, fontWeight: "800" },
  trashRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  trashName: { flex: 1, fontSize: 12 },
  restore: { fontSize: 12, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  renameModal: { padding: 18, gap: 14 },
  renameTitle: { fontSize: 17, fontWeight: "800" },
  renameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 4 },
});
