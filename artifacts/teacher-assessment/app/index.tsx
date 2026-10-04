import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { generateArabicSchedulePdfHtml } from '@/services/arabicSchedulePdf';

const STORAGE_KEY = 'arabic-school-schedule-v1';
const TIMES = ['08-09', '09-10', '10-11', '11-12', '13-14', '14-15', '15-16', '16-17'];
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

type ScheduleData = {
  title: string;
  subtitle: string;
  footer: string;
  cells: Record<string, string>;
};

const initialData: ScheduleData = {
  title: 'ثانوية المجاهد عبد الحميد درواز أولاد فايت',
  subtitle: 'شعبة الدرع',
  footer: 'أنتج الجدول بواسطة FET 7.10.1 في 20/09/2026 على الساعة 12:45 م',
  cells: {
    'الأحد|09-10': 'آف2أ\nاللغة الفرنسية',
    'الأحد|10-11': 'آف1أ\nاللغة الفرنسية',
    'الإثنين|13-14': '1آف2\nاللغة الفرنسية',
    'الإثنين|15-16': '3ع1\nاللغة الفرنسية',
    'الإثنين|16-17': '5ع1\nاللغة الفرنسية',
    'الأربعاء|13-14': '2آف2\nاللغة الفرنسية',
    'الأربعاء|15-16': '3ع1\nاللغة الفرنسية',
    'الأربعاء|16-17': '5ع1\nاللغة الفرنسية',
    'الخميس|09-10': '5آف1\nاللغة الفرنسية',
    'الخميس|10-11': '1آف2\nاللغة الفرنسية',
    'الخميس|11-12': '3ع1\nاللغة الفرنسية',
    'الخميس|12-13': '2آف2\nاللغة الفرنسية',
  },
};

function emptyData(): ScheduleData {
  return { ...initialData, cells: { ...initialData.cells } };
}

export default function IndexScreen() {
  const [data, setData] = useState<ScheduleData>(emptyData);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<{ day: string; time: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          setData(JSON.parse(stored) as ScheduleData);
        } catch {
          setData(emptyData());
        }
      }
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const openCell = (day: string, time: string) => {
    setEditing({ day, time });
    setDraft(data.cells[`${day}|${time}`] ?? '');
  };

  const saveCell = () => {
    if (!editing) return;
    const key = `${editing.day}|${editing.time}`;
    setData((current) => ({
      ...current,
      cells: { ...current.cells, ...(draft.trim() ? { [key]: draft.trim() } : (() => {
        const next = { ...current.cells };
        delete next[key];
        return next;
      })()) },
    }));
    setEditing(null);
  };

  const resetSchedule = () => {
    Alert.alert('إعادة ضبط الجدول', 'هل تريد حذف التعديلات واستعادة النموذج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إعادة الضبط', style: 'destructive', onPress: () => setData(emptyData()) },
    ]);
  };

  const html = useMemo(() => generateArabicSchedulePdfHtml({ ...data, times: TIMES, days: DAYS }), [data]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const result = await Print.printToFileAsync({ html, base64: false });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('تم إنشاء الملف', 'تم إنشاء ملف PDF في ذاكرة التطبيق.');
        return;
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'حفظ أو مشاركة الجدول',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      Alert.alert('تعذر إنشاء PDF', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setExporting(false);
    }
  };

  if (!hydrated) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <View style={styles.brandMark}><Feather name="calendar" size={22} color="#ffffff" /></View>
          <View style={styles.topCopy}>
            <Text style={styles.kicker}>منشئ الجداول المدرسية</Text>
            <Text style={styles.appTitle}>جدولي الدراسي</Text>
          </View>
          <Pressable onPress={resetSchedule} style={styles.iconButton} accessibilityLabel="إعادة ضبط الجدول">
            <Feather name="rotate-ccw" size={19} color="#52606d" />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>أنشئ جدولك بصيغة PDF</Text>
          <Text style={styles.heroText}>اضغط على أي خانة لإضافة القسم والمادة، ثم شارك النسخة الجاهزة للطباعة.</Text>
          <Pressable onPress={exportPdf} disabled={exporting} style={({ pressed }) => [styles.exportButton, pressed && styles.pressed, exporting && styles.disabled]}>
            <Feather name="file-text" size={19} color="#ffffff" />
            <Text style={styles.exportText}>{exporting ? 'جارٍ إعداد PDF…' : 'تصدير الجدول PDF'}</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>معلومات الرأس</Text>
          <Text style={styles.label}>اسم المؤسسة</Text>
          <TextInput value={data.title} onChangeText={(title) => setData((current) => ({ ...current, title }))} style={styles.input} textAlign="right" />
          <Text style={styles.label}>القسم أو الشعبة</Text>
          <TextInput value={data.subtitle} onChangeText={(subtitle) => setData((current) => ({ ...current, subtitle }))} style={styles.input} textAlign="right" />
          <Text style={styles.label}>ملاحظة أسفل الجدول</Text>
          <TextInput value={data.footer} onChangeText={(footer) => setData((current) => ({ ...current, footer }))} style={styles.input} textAlign="right" />
        </View>

        <View style={styles.previewHeader}>
          <View><Text style={styles.sectionTitle}>معاينة الجدول</Text><Text style={styles.helper}>اضغط على الخانة لتعديلها</Text></View>
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>محفوظ تلقائياً</Text></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
          <View style={styles.table}>
            <View style={styles.row}>
              <View style={[styles.dayCell, styles.headerCell]}><Text style={styles.headerText}>اليوم</Text></View>
              {TIMES.slice().reverse().map((time) => <View key={time} style={[styles.timeCell, styles.headerCell]}><Text style={styles.headerText}>{time}</Text></View>)}
            </View>
            {DAYS.map((day) => (
              <View key={day} style={styles.row}>
                <View style={styles.dayCell}><Text style={styles.dayText}>{day}</Text></View>
                {TIMES.slice().reverse().map((time) => {
                  const value = data.cells[`${day}|${time}`];
                  return <Pressable key={time} onPress={() => openCell(day, time)} style={({ pressed }) => [styles.timeCell, styles.dataCell, value ? styles.filledCell : styles.emptyCell, pressed && styles.cellPressed]}>
                    <Text style={[styles.cellText, !value && styles.emptyText]}>{value || '---'}</Text>
                  </Pressable>;
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.footerHint}>يتم حفظ الجدول محلياً على جهازك. لا تحتاج إلى اتصال بالإنترنت لإنشاء PDF.</Text>
      </ScrollView>

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing?.day} · {editing?.time}</Text><Pressable onPress={() => setEditing(null)}><Feather name="x" size={22} color="#52606d" /></Pressable></View>
            <Text style={styles.modalHint}>اكتب اسم القسم في السطر الأول والمادة في السطر الثاني.</Text>
            <TextInput value={draft} onChangeText={setDraft} multiline autoFocus placeholder={'مثال:\n1آف2\nاللغة الفرنسية'} style={[styles.input, styles.cellInput]} textAlign="right" textAlignVertical="top" />
            <View style={styles.modalActions}><Pressable onPress={() => setEditing(null)} style={styles.cancelButton}><Text style={styles.cancelText}>إلغاء</Text></Pressable><Pressable onPress={saveCell} style={styles.saveButton}><Text style={styles.saveText}>حفظ الخانة</Text></Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f5f0' },
  page: { padding: 20, paddingBottom: 42, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#173b49', alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1 },
  kicker: { color: '#9a6b43', fontSize: 11, fontWeight: '800', textAlign: 'right', letterSpacing: 0.5 },
  appTitle: { color: '#173b49', fontSize: 22, fontWeight: '900', textAlign: 'right', marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: '#ddd7cd', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffdf9' },
  hero: { backgroundColor: '#173b49', borderRadius: 22, padding: 20, gap: 10 },
  heroTitle: { color: '#fffdf9', fontSize: 24, fontWeight: '900', textAlign: 'right' },
  heroText: { color: '#dce9e9', fontSize: 14, lineHeight: 22, textAlign: 'right' },
  exportButton: { alignSelf: 'flex-end', backgroundColor: '#d36f4e', borderRadius: 13, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 5 },
  exportText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.55 },
  formCard: { backgroundColor: '#fffdf9', borderWidth: 1, borderColor: '#e3ddd2', borderRadius: 18, padding: 16, gap: 8 },
  sectionTitle: { color: '#173b49', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  label: { color: '#806c5d', fontSize: 12, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#d9d1c5', borderRadius: 12, backgroundColor: '#ffffff', paddingHorizontal: 13, paddingVertical: 10, color: '#24333b', fontSize: 15 },
  previewHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  helper: { color: '#9b8c80', fontSize: 12, textAlign: 'right', marginTop: 3 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e7f1eb', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4c9369' }, liveText: { color: '#377454', fontSize: 11, fontWeight: '800' },
  tableScroll: { paddingBottom: 3 },
  table: { borderWidth: 1, borderColor: '#a9a39a', backgroundColor: '#fffdf9', minWidth: 920 },
  row: { flexDirection: 'row' },
  headerCell: { backgroundColor: '#ebe4d7' },
  dayCell: { width: 92, minHeight: 86, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#a9a39a', alignItems: 'center', justifyContent: 'center', padding: 5 },
  timeCell: { width: 92, minHeight: 86, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#a9a39a', alignItems: 'center', justifyContent: 'center', padding: 5 },
  dataCell: { backgroundColor: '#fffdf9' }, filledCell: { backgroundColor: '#f3eee5' }, emptyCell: { backgroundColor: '#fffdf9' }, cellPressed: { backgroundColor: '#e8f0ed' },
  headerText: { color: '#24333b', fontSize: 13, fontWeight: '900', textAlign: 'center' }, dayText: { color: '#173b49', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  cellText: { color: '#293840', fontSize: 13, lineHeight: 20, textAlign: 'center', fontWeight: '700' }, emptyText: { color: '#b2aaa0', fontWeight: '500' },
  footerHint: { color: '#9b8c80', fontSize: 12, lineHeight: 18, textAlign: 'right' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 31, 37, 0.42)' },
  modalCard: { backgroundColor: '#fffdf9', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { color: '#173b49', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  modalHint: { color: '#806c5d', fontSize: 13, textAlign: 'right', lineHeight: 20 }, cellInput: { minHeight: 110 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-start', gap: 10, marginTop: 3 }, cancelButton: { borderWidth: 1, borderColor: '#d9d1c5', paddingHorizontal: 17, paddingVertical: 12, borderRadius: 12 }, cancelText: { color: '#52606d', fontWeight: '800' }, saveButton: { backgroundColor: '#d36f4e', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 }, saveText: { color: '#ffffff', fontWeight: '900' },
});
