import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type DialogButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type DialogOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type DialogState = {
  title: string;
  message?: string;
  buttons: DialogButton[];
  options?: DialogOptions;
};

let updateDialog: ((dialog: DialogState | null) => void) | null = null;
let queuedDialog: DialogState | null = null;

export const Alert = {
  alert(title: string, message?: string, buttons?: DialogButton[], options?: DialogOptions) {
    const dialog = {
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK', style: 'default' as const }],
      options,
    };
    if (updateDialog) updateDialog(dialog);
    else queuedDialog = dialog;
  },
};

export function AppDialogHost() {
  const colors = useColors();
  const [dialog, setDialog] = useState<DialogState | null>(queuedDialog);

  useEffect(() => {
    updateDialog = setDialog;
    if (queuedDialog) {
      setDialog(queuedDialog);
      queuedDialog = null;
    }
    return () => {
      updateDialog = null;
    };
  }, []);

  const dismiss = () => {
    const onDismiss = dialog?.options?.onDismiss;
    setDialog(null);
    onDismiss?.();
  };

  const pressButton = (button: DialogButton) => {
    setDialog(null);
    button.onPress?.();
  };

  const destructive = dialog?.buttons.some((button) => button.style === 'destructive') ?? false;

  return (
    <Modal
      visible={dialog !== null}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dialog?.options?.cancelable !== false) dismiss();
      }}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.icon, { backgroundColor: destructive ? colors.errorSurface : colors.accent }]}>
            <Feather
              name={destructive ? 'alert-triangle' : 'info'}
              size={21}
              color={destructive ? colors.errorForeground : colors.primary}
            />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{dialog?.title}</Text>
          {dialog?.message ? (
            <Text style={[styles.message, { color: colors.mutedForeground }]}>{dialog.message}</Text>
          ) : null}
          <View style={[styles.actions, dialog && dialog.buttons.length > 2 && styles.stackedActions]}>
            {dialog?.buttons.map((button, index) => {
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel';
              const isPrimary = !isCancel && (!dialog.buttons.some((item) => item.style === 'destructive') || isDestructive);
              return (
                <Pressable
                  key={`${button.text ?? 'action'}-${index}`}
                  accessibilityRole="button"
                  onPress={() => pressButton(button)}
                  style={({ pressed }) => [
                    styles.action,
                    dialog.buttons.length > 2 && styles.stackedAction,
                    {
                      backgroundColor: isPrimary
                        ? isDestructive ? colors.errorForeground : colors.primary
                        : colors.secondary,
                      borderColor: isPrimary
                        ? isDestructive ? colors.errorForeground : colors.primary
                        : colors.border,
                      opacity: pressed ? 0.78 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.actionText,
                      { color: isPrimary ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {button.text ?? (index === 0 ? 'Annuler' : 'Continuer')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10, 15, 25, 0.55)', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center', gap: 12, elevation: 14 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 8 },
  stackedActions: { flexDirection: 'column' },
  action: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  stackedAction: { width: '100%', flexGrow: 0 },
  actionText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
