import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function RecoveryCodeDialog({ code, onDone }: { code: string; onDone: () => void }) {
  const colors = useColors();
  return (
    <Modal visible={Boolean(code)} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.warningSurface }]}>
            <Feather name="key" size={22} color={colors.warningForeground} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Conservez votre code de récupération</Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            Ce code ne sera affiché qu’une fois. Notez-le et gardez-le hors de l’application. Il permet de définir un nouveau PIN et sera remplacé après utilisation.
          </Text>
          <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text selectable accessibilityLabel="Code de récupération à usage unique" style={[styles.code, { color: colors.foreground }]}>
              {code}
            </Text>
          </View>
          <Text style={[styles.warning, { color: colors.warningForeground }]}>
            Toute personne ayant ce code peut remplacer votre PIN.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>J’ai noté mon code</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(10, 15, 25, 0.62)', padding: 20 },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'stretch', borderWidth: 1, borderRadius: 22, padding: 22, gap: 12, elevation: 16 },
  icon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  codeBox: { minHeight: 58, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 12 },
  code: { fontSize: 16, lineHeight: 22, fontWeight: '800', letterSpacing: 1.3, textAlign: 'center' },
  warning: { fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  button: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12, marginTop: 3 },
  buttonText: { fontSize: 13, fontWeight: '800' },
});
