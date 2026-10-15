import { Alert } from "@/components/AppDialog";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import { LocalDocumentShareModal } from "@/components/LocalDocumentShareModal";
import {
  Modal,
  Platform,
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
  Screen,
  SelectionCheckbox,
  Surface,
} from "@/components/AppShell";
import { useColors } from "@/hooks/useColors";
import { useStorage, type StorageFolder, type StoredDocument } from "@/context/StorageContext";
import { getDocumentMediaType } from "@/services/documentMedia";
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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [moveTarget, setMoveTarget] = useState<StoredDocument | null>(null);
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [previewFile, setPreviewFile] = useState<StoredDocument | null>(null);
  const [qrShareFile, setQrShareFile] = useState<StoredDocument | null>(null);
  const visibleFolders = useMemo(
    () => storage.folders.filter((folder) => folder.parentId === currentFolderId),
    [currentFolderId, storage.folders],
  );
  const folderPath = useMemo(() => {
    const path: StorageFolder[] = [];
    let folder = storage.folders.find((item) => item.id === currentFolderId);
    while (folder) {
      path.unshift(folder);
      folder = storage.folders.find((item) => item.id === folder?.parentId);
    }
    return path;
  }, [currentFolderId, storage.folders]);
  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const result = normalizedQuery
      ? storage.files.filter((file) =>
          file.folderId === currentFolderId && file.name.toLocaleLowerCase().includes(normalizedQuery),
        )
      : storage.files.filter((file) => (file.folderId ?? null) === currentFolderId);
    return result.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "size"
          ? (b.size ?? 0) - (a.size ?? 0)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [currentFolderId, query, sort, storage.files]);

  const orderedFolders = useMemo(
    () => [...visibleFolders].sort((a, b) => a.name.localeCompare(b.name)),
    [visibleFolders],
  );
  const orderedFoldersForMove = useMemo(() => {
    const getPath = (folder: StorageFolder) => {
      const names = [folder.name];
      let parent = storage.folders.find((item) => item.id === folder.parentId);
      while (parent) {
        names.unshift(parent.name);
        parent = storage.folders.find((item) => item.id === parent?.parentId);
      }
      return names.join(" / ");
    };
    return [...storage.folders]
      .map((folder) => ({ ...folder, pathLabel: getPath(folder) }))
      .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel));
  }, [storage.folders]);
  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setQuery("");
    selection.cancelSelection();
  };

  const handleUpload = async () => {
    try {
      await storage.uploadDocuments(currentFolderId);
    } catch (error) {
      Alert.alert(
        "Import impossible",
        error instanceof Error
          ? error.message
          : "Le document n’a pas pu être ajouté au stockage.",
      );
    }
  };
  const handleShare = (file: StoredDocument) => {
    const buttons = [
      {
        text: "Partage du téléphone (Bluetooth / Quick Share / AirDrop)",
        onPress: () => {
          void storage.openDocument(file).catch((error) => {
            Alert.alert(
              "Partage impossible",
              error instanceof Error ? error.message : "Le document n’a pas pu être partagé.",
            );
          });
        },
      },
      ...(Platform.OS === "web"
        ? []
        : [{ text: "QR code (même Wi-Fi)", onPress: () => setQrShareFile(file) }]),
      { text: "Annuler", style: "cancel" as const },
    ];
    Alert.alert(
      "Partager le document",
      "Choisissez le partage du téléphone ou un transfert local par QR code.",
      buttons,
    );
  };
  const saveFolder = async () => {
    try {
      await storage.createFolder(folderName, currentFolderId);
      setFolderName("");
      setFolderModalVisible(false);
    } catch (error) {
      Alert.alert("Création impossible", error instanceof Error ? error.message : "Le dossier n’a pas pu être créé.");
    }
  };
  const handleDeleteFolder = (folder: StorageFolder) => {
    const hasFiles = storage.files.some((file) => file.folderId === folder.id);
    const hasFolders = storage.folders.some((item) => item.parentId === folder.id);
    const hasTrashedFiles = storage.trash.some((file) => file.folderId === folder.id);
    if (hasFiles || hasFolders || hasTrashedFiles) {
      Alert.alert(
        "Dossier non vide",
        "Déplacez les documents et sous-dossiers qu’il contient. Restaurez ou supprimez définitivement les éléments qui se trouvent dans la corbeille.",
      );
      return;
    }
    Alert.alert(
      "Supprimer ce dossier ?",
      `Le dossier « ${folder.name} » sera supprimé.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void storage.deleteFolder(folder.id).catch((error) => {
              Alert.alert(
                "Suppression impossible",
                error instanceof Error ? error.message : "Le dossier n’a pas pu être supprimé.",
              );
            });
          },
        },
      ],
    );
  };
  const saveMove = async () => {
    if (!moveTarget) return;
    try {
      await storage.moveDocumentToFolder(moveTarget.id, moveFolderId);
      setMoveTarget(null);
    } catch (error) {
      Alert.alert("Déplacement impossible", error instanceof Error ? error.message : "Le document n’a pas pu être déplacé.");
    }
  };
  const handleDeleteSelectedFiles = () => {
    const selected = storage.files.filter((file) => selection.selectedIds.includes(file.id));
    if (selected.length === 0) return;
    Alert.alert(
      "Supprimer les documents sélectionnés ?",
      `${selected.length} document${selected.length > 1 ? "s" : ""} sera${selected.length > 1 ? "ont" : ""} déplacé${selected.length > 1 ? "s" : ""} dans la corbeille.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            selected.forEach((file) => { void storage.deleteDocument(file); });
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
      await storage.renameDocument(file, renameInput);
      setRenameTarget(null);
    } catch (error) {
      Alert.alert(
        "Renommage impossible",
        error instanceof Error ? error.message : "Erreur de fichier.",
      );
    }
  };

  return (
    <Screen
      floatingContent={selection.isSelecting ? (
        <View style={[styles.selectionDock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.selectionDockCount, { color: colors.foreground }]}>
            {selection.selectedIds.length} sélectionné{selection.selectedIds.length > 1 ? "s" : ""}
          </Text>
          <View style={styles.selectionDockActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler la sélection"
              onPress={selection.cancelSelection}
              style={[styles.selectionDockButton, { backgroundColor: colors.secondary }]}
            >
              <Feather name="x" size={19} color={colors.foreground} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Supprimer les documents sélectionnés"
              accessibilityState={{ disabled: selection.selectedIds.length === 0 }}
              disabled={selection.selectedIds.length === 0}
              onPress={handleDeleteSelectedFiles}
              style={[
                styles.selectionDockButton,
                { backgroundColor: colors.errorSurface },
                selection.selectedIds.length === 0 && styles.selectionDockButtonDisabled,
              ]}
            >
              <Feather name="trash-2" size={18} color={colors.errorForeground} />
            </Pressable>
          </View>
        </View>
      ) : null}
    >
      <AppHeader eyebrow="Documents de l’enseignant" title="Documents" />
      <Surface style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.accent }]}>
          <Feather name="folder" size={25} color={colors.primary} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Ma bibliothèque de documents
          </Text>
          <Text style={[styles.heroText, { color: colors.mutedForeground }]}>
            Ajoutez vos PDF, images et vidéos pédagogiques pour les retrouver
            rapidement hors connexion. Maximum 200 Mo par fichier.
          </Text>
        </View>
        <Button
          label="Ajouter des documents"
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
      <View style={styles.breadcrumbs}>
        <Pressable onPress={() => navigateToFolder(null)}>
          <Text style={[styles.breadcrumb, { color: currentFolderId ? colors.primary : colors.foreground }]}>
            Mes documents
          </Text>
        </Pressable>
        {folderPath.map((folder) => (
          <React.Fragment key={folder.id}>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            <Pressable onPress={() => navigateToFolder(folder.id)}>
              <Text style={[styles.breadcrumb, { color: folder.id === currentFolderId ? colors.foreground : colors.primary }]}>
                {folder.name}
              </Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
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
          placeholder="Rechercher un document…"
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
      <View style={styles.libraryActions}>
        <View style={styles.libraryActionGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Trier par ${sort === "date" ? "date, plus récent" : sort === "name" ? "nom" : "taille"}`}
            onPress={() =>
              setSort(sort === "date" ? "name" : sort === "name" ? "size" : "date")
            }
            style={[styles.compactControl, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="filter" size={15} color={colors.primary} />
            <Text style={[styles.sortText, { color: colors.foreground }]}>
              {sort === "date" ? "Récent" : sort === "name" ? "Nom" : "Taille"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Créer un dossier"
            onPress={() => {
              setFolderName("");
              setFolderModalVisible(true);
            }}
            style={[styles.compactIconControl, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="folder-plus" size={17} color={colors.primary} />
          </Pressable>
          {storage.files.length > 0 && !selection.isSelecting ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sélectionner des documents"
              onPress={() => selection.startSelecting()}
              style={[styles.compactIconControl, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="check-square" size={17} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.viewToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vue en liste"
            onPress={() => setViewMode("list")}
            style={[styles.viewOption, viewMode === "list" && { backgroundColor: colors.accent }]}
          >
            <Feather name="list" size={17} color={viewMode === "list" ? colors.primary : colors.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vue en grille"
            onPress={() => setViewMode("grid")}
            style={[styles.viewOption, viewMode === "grid" && { backgroundColor: colors.accent }]}
          >
            <Feather name="grid" size={17} color={viewMode === "grid" ? colors.primary : colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
      {filteredFiles.length === 0 && orderedFolders.length === 0 ? (
        <Surface style={styles.empty}>
          <Feather
            name={query ? "search" : "file-text"}
            size={34}
            color={colors.mutedForeground}
          />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {query ? "Aucun document trouvé" : "Aucun document dans ce dossier"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {query
              ? "Essayez un autre nom de fichier."
            : "Ajoutez un PDF, une image ou une vidéo, ou créez un dossier pour organiser vos ressources pédagogiques."}
          </Text>
          {!query ? (
            <Button
              label="Ajouter des documents"
              compact
              icon="plus"
              onPress={() => {
                void handleUpload();
              }}
            />
          ) : null}
        </Surface>
      ) : (
        <View style={[styles.list, viewMode === "grid" && styles.grid]}>
          {orderedFolders.map((folder) => {
            const childCount = storage.files.filter((file) => file.folderId === folder.id).length;
            const nestedCount = storage.folders.filter((item) => item.parentId === folder.id).length;
            return (
              <Surface key={folder.id} style={[styles.folderCard, viewMode === "grid" && styles.folderGridCard]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir le dossier ${folder.name}`}
                  onPress={() => {
                    navigateToFolder(folder.id);
                  }}
                  style={[styles.folderOpen, viewMode === "grid" && styles.folderOpenGrid]}
                >
                  <View style={[styles.folderIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="folder" size={21} color={colors.primary} />
                  </View>
                  <View style={styles.fileCopy}>
                    <Text numberOfLines={2} style={[styles.fileName, { color: colors.foreground }]}>{folder.name}</Text>
                    <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                      {childCount} document{childCount === 1 ? "" : "s"} · {nestedCount} dossier{nestedCount === 1 ? "" : "s"}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer le dossier ${folder.name}`}
                  onPress={() => handleDeleteFolder(folder)}
                  hitSlop={8}
                  style={styles.folderDelete}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </Surface>
            );
          })}
          {filteredFiles.map((file) => {
            const mediaType = getDocumentMediaType(file.name, file.mimeType);
            return (
            <Surface
              key={file.id}
              style={[
                styles.fileCard,
                viewMode === "grid" && styles.fileGridCard,
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
                  viewMode === "grid" && styles.fileGridIcon,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Feather
                  name={mediaType === "image" ? "image" : mediaType === "video" ? "video" : "file-text"}
                  size={21}
                  color={colors.primary}
                />
              </View>
              <View style={[styles.fileCopy, viewMode === "grid" && styles.fileGridCopy]}>
                <Pressable
                  onTouchStart={(event) => event.stopPropagation()}
                  onPress={() => {
                    if (selection.isSelecting) selection.toggleSelection(file.id);
                  }}
                  accessibilityHint={selection.isSelecting ? 'Touchez pour sélectionner ce document.' : undefined}
                >
                  <Text numberOfLines={2} style={[styles.fileName, { color: colors.foreground }]}>{file.name}</Text>
                </Pressable>
                <Text
                  style={[styles.fileMeta, { color: colors.mutedForeground }]}
                >
                  {formatSize(file.size)} ·{" "}
                  {mediaType === "pdf" ? "PDF" : mediaType === "image" ? "Image" : "Vidéo"} ·{" "}
                  {new Date(file.createdAt).toLocaleDateString("fr-FR")}
                </Text>
              </View>
              {selection.isSelecting ? (
                <SelectionCheckbox checked={selection.selectedIds.includes(file.id)} />
              ) : (
                <View style={[styles.fileActions, viewMode === "grid" && styles.fileGridActions]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Prévisualiser ${file.name}`}
                    onPress={() => setPreviewFile(file)}
                    style={[styles.action, viewMode === "grid" && styles.gridAction, { backgroundColor: colors.accent }]}
                  >
                    <Feather name="eye" size={17} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Partager ${file.name}`}
                    onPress={() => handleShare(file)}
                    style={[styles.action, viewMode === "grid" && styles.gridAction, { backgroundColor: colors.accent }]}
                  >
                    <Feather name="share-2" size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setRenameTarget(file.id);
                      setRenameInput(file.name.replace(/\.[^.]+$/, ""));
                    }}
                    style={[styles.action, viewMode === "grid" && styles.gridAction, { backgroundColor: colors.secondary }]}
                  >
                    <Feather name="edit-2" size={16} color={colors.foreground} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Déplacer ${file.name} vers un dossier`}
                    onPress={() => {
                      setMoveFolderId(file.folderId ?? null);
                      setMoveTarget(file);
                    }}
                    style={[styles.action, viewMode === "grid" && styles.gridAction, { backgroundColor: colors.secondary }]}
                  >
                    <Feather name="folder" size={16} color={colors.foreground} />
                  </Pressable>
                </View>
              )}
            </Surface>
          );})}
        </View>
      )}
      {storage.trash.length > 0 ? (
        <Surface style={styles.trash}>
          <View style={styles.trashHeader}>
            <Text style={[styles.trashTitle, { color: colors.foreground }]}>
              Corbeille ({storage.trash.length})
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vider la corbeille"
              accessibilityState={{ disabled: emptyingTrash }}
              disabled={emptyingTrash}
              onPress={() => Alert.alert(
                  "Vider la corbeille ?",
                  "Les fichiers seront définitivement supprimés.",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Supprimer",
                      style: "destructive",
                      onPress: async () => {
                        setEmptyingTrash(true);
                        try {
                          await storage.emptyTrash();
                        } catch (error) {
                          Alert.alert(
                            "Suppression impossible",
                            error instanceof Error ? error.message : "La corbeille n’a pas pu être vidée.",
                          );
                        } finally {
                          setEmptyingTrash(false);
                        }
                      },
                    },
                  ],
                )}
              style={({ pressed }) => [
                styles.emptyTrashButton,
                {
                  backgroundColor: colors.errorSurface,
                  opacity: emptyingTrash ? 0.5 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Feather name="trash-2" size={17} color={colors.errorForeground} />
            </Pressable>
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
                    .restoreDocument(file)
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
        visible={folderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalBackdrop}>
          <Surface style={styles.renameModal}>
            <Text style={[styles.renameTitle, { color: colors.foreground }]}>
              Créer un dossier
            </Text>
            <TextInput
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
              placeholder="Nom du dossier"
              placeholderTextColor={colors.mutedForeground}
              onSubmitEditing={() => { void saveFolder(); }}
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
              <Button label="Créer" compact onPress={() => { void saveFolder(); }} />
              <Button label="Annuler" compact secondary onPress={() => setFolderModalVisible(false)} />
            </View>
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>
      <Modal
        visible={moveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveTarget(null)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalBackdrop}>
          <Surface style={styles.renameModal}>
            <Text style={[styles.renameTitle, { color: colors.foreground }]}>
              Déplacer le document
            </Text>
            <View style={styles.destinationList}>
              <Pressable
                onPress={() => setMoveFolderId(null)}
                style={[
                  styles.destinationOption,
                  { borderColor: colors.border, backgroundColor: moveFolderId === null ? colors.accent : colors.background },
                ]}
              >
                <Feather name="home" size={17} color={colors.primary} />
                <Text style={[styles.destinationText, { color: colors.foreground }]}>Mes documents</Text>
                {moveFolderId === null ? <Feather name="check" size={17} color={colors.primary} /> : null}
              </Pressable>
              {orderedFoldersForMove.map((folder) => (
                <Pressable
                  key={folder.id}
                  onPress={() => setMoveFolderId(folder.id)}
                  style={[
                    styles.destinationOption,
                    { borderColor: colors.border, backgroundColor: moveFolderId === folder.id ? colors.accent : colors.background },
                  ]}
                >
                  <Feather name="folder" size={17} color={colors.primary} />
                  <Text numberOfLines={1} style={[styles.destinationText, { color: colors.foreground }]}>
                    {folder.pathLabel}
                  </Text>
                  {moveFolderId === folder.id ? <Feather name="check" size={17} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
            <View style={styles.buttonRow}>
              <Button label="Déplacer" compact onPress={() => { void saveMove(); }} />
              <Button label="Annuler" compact secondary onPress={() => setMoveTarget(null)} />
            </View>
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>
      <Modal
        visible={Boolean(renameTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalBackdrop}>
          <Surface style={styles.renameModal}>
            <Text style={[styles.renameTitle, { color: colors.foreground }]}>
              Renommer le document
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
      <PdfPreviewModal
        visible={previewFile !== null}
        title={previewFile?.name ?? "Document pédagogique"}
        uri={previewFile?.uri}
        mimeType={previewFile?.mimeType}
        filename={previewFile?.name ?? "document.pdf"}
        onClose={() => setPreviewFile(null)}
      />
      <LocalDocumentShareModal
        visible={qrShareFile !== null}
        file={qrShareFile}
        onClose={() => setQrShareFile(null)}
      />
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
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 7 },
  breadcrumbs: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" },
  breadcrumb: { fontSize: 12, fontWeight: "700" },
  compactControl: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
  },
  compactIconControl: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
  sortText: { fontSize: 12, fontWeight: "700" },
  libraryActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7, marginBottom: 8 },
  libraryActionGroup: { flexDirection: "row", alignItems: "center", gap: 7 },
  viewToggle: { flexDirection: "row", alignItems: "center", padding: 3, borderWidth: 1, borderRadius: 11, gap: 2 },
  viewOption: { width: 34, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  list: { gap: 10, paddingBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  fileCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13 },
  fileGridCard: { width: "48%", minHeight: 160, flexDirection: "column", alignItems: "stretch", justifyContent: "space-between", gap: 10 },
  fileActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileGridActions: { justifyContent: "flex-start", flexWrap: "wrap", gap: 6 },
  fileGridIcon: { alignSelf: "flex-start" },
  fileGridCopy: { width: "100%", minHeight: 44 },
  selectionDock: {
    minHeight: 54,
    maxWidth: 360,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    opacity: 0.96,
    shadowColor: "#172b3a",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 9,
  },
  selectionDockCount: { fontSize: 13, fontWeight: "700" },
  selectionDockActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectionDockButton: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  selectionDockButtonDisabled: { opacity: 0.45 },
  folderCard: { overflow: "hidden" },
  folderGridCard: { width: "48%" },
  folderOpen: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, paddingRight: 42 },
  folderOpenGrid: { minHeight: 160, flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between" },
  folderDelete: { position: "absolute", top: 10, right: 10, width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  folderIcon: { width: 43, height: 43, borderRadius: 13, alignItems: "center", justifyContent: "center" },
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
  gridAction: { width: 30, height: 30 },
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
  emptyTrashButton: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
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
  destinationList: { maxHeight: 300, gap: 7 },
  destinationOption: { minHeight: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 9 },
  destinationText: { flex: 1, fontSize: 13, fontWeight: "600" },
});
