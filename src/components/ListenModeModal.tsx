import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { accent } from '@/theme/theme';
import { useListenModeCtx, toggleWordTypeFilterKey } from '@/store/ListenModeContext';
import {
  SLEEP_TIMER_PRESETS,
  RATE_MIN,
  RATE_MAX,
  RATE_STEP,
  GAP_MIN,
  GAP_MAX,
  GAP_STEP,
  REPEAT_MIN,
  REPEAT_MAX,
  BATCH_SIZE_MIN,
  BATCH_SIZE_STEP,
} from '@/hooks/useListenMode';
import { getGermanExample, getVietnameseExample } from '@/utils/grading';
import BottomSheetModal from './BottomSheetModal';
import WordTypeFilterDropdown from './WordTypeFilterDropdown';
import Icon, { IconProps } from './Icon';

/**
 * "Nghe từ vựng" — phát tuần tự nguyên từ → nghĩa → câu ví dụ (Đức - Việt)
 * cho toàn bộ danh sách từ, chạy dưới nền thật sự (xem startKeepAliveAudio
 * trong services/tts.ts) và chỉnh được tốc độ đọc + tốc độ chuyển từ, bật
 * tắt từng phần muốn nghe, lặp lại theo từ/theo nhóm, chia nhóm, phát ngẫu
 * nhiên, và hẹn giờ tự dừng.
 *
 * BỐ CỤC (đã đổi): trước đây TẤT CẢ cài đặt (Đọc phần nào / Loại từ / Lặp
 * lại / Chia nhóm từ / Hẹn giờ đóng) nằm thẳng trong ScrollView của màn
 * hình chính — chiếm hết chỗ, che mất phần thẻ từ + cụm nút phát bên
 * dưới, phải cuộn qua hết mới thao tác được. Giờ màn hình chính chỉ còn:
 * tiêu đề, tiến độ, thẻ từ, cụm nút điều khiển — GỌN, không cần cuộn. Toàn
 * bộ cài đặt dồn vào DUY NHẤT 1 popup ("Cài đặt nghe", BottomSheetModal),
 * mở bằng nút bánh răng cạnh cụm nút phát — bấm ra ngoài popup là đóng
 * ngay, quay lại thao tác với thẻ từ/nút phát bình thường, không bị chặn.
 *
 * ÁP DỤNG KHI BẤM "LƯU" (không còn tức thời): mọi cài đặt bên trong popup
 * này (Tốc độ / Loại từ / Lặp lại / Chia nhóm từ / Hẹn giờ đóng) giờ chỉnh
 * trên 1 bản NHÁP (`draft`, state cục bộ của component này) — chỉ thật sự
 * ghi vào ListenModeContext (và qua đó persist AsyncStorage như cũ) khi bấm
 * nút "Lưu cài đặt". Bấm ra ngoài popup (hoặc nút ✕) mà KHÔNG bấm Lưu thì
 * mọi chỉnh sửa trong bản nháp bị bỏ, coi như chưa từng đổi. Bản nháp được
 * nạp lại từ giá trị THẬT mỗi lần mở popup (xem `openSettings`), nên lần mở
 * sau luôn phản ánh đúng cài đặt đã lưu gần nhất — không bị "nhớ nhầm" bản
 * nháp cũ bị bỏ dở của lần trước.
 * Riêng "Đọc phần nào" (Từ/Nghĩa/Ví dụ, bấm trực tiếp trên thẻ từ) và
 * "Ngẫu nhiên" (nút xáo trộn cạnh cụm phát) nằm NGOÀI popup này nên vẫn áp
 * dụng tức thời như trước — không thuộc phạm vi "Lưu cài đặt".
 *
 * Toàn bộ state/điều khiển giờ lấy từ ListenModeContext (gắn ở gốc app) chứ
 * không tự tạo hook riêng — nhờ vậy đóng/mở modal này KHÔNG làm gián đoạn
 * giọng đọc đang phát. Nút ✕ dừng hẳn; nút "─" chỉ thu nhỏ thành nút nổi.
 */
interface SettingsDraft {
  rate: number;
  nextWordDelayMs: number;
  repeatWordCount: number;
  repeatBatchCount: number;
  batchSize: number;
  sleepMinutes: number;
  wordTypeFilter: string[] | null;
  sortByWordType: boolean;
}

export default function ListenModeModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listen = useListenModeCtx();
  // Toàn bộ cài đặt (tốc độ, đọc phần nào, loại từ, lặp lại, chia nhóm,
  // hẹn giờ) giờ gom chung vào 1 popup DUY NHẤT, mở bằng nút bánh răng.
  const [settingsPopupVisible, setSettingsPopupVisible] = useState(false);
  // Bộ lọc "Loại từ" kiểu Excel mở như 1 popup con, chồng lên trên popup
  // cài đặt chính (bấm ra ngoài đóng riêng popup con, không đóng luôn popup
  // cha).
  const [wordTypeFilterVisible, setWordTypeFilterVisible] = useState(false);
  // Bản NHÁP của mọi cài đặt trong popup — xem giải thích ở docstring trên.
  const [draft, setDraft] = useState<SettingsDraft>({
    rate: listen.rate,
    nextWordDelayMs: listen.nextWordDelayMs,
    repeatWordCount: listen.repeatWordCount,
    repeatBatchCount: listen.repeatBatchCount,
    batchSize: listen.batchSize,
    sleepMinutes: listen.sleepMinutes,
    wordTypeFilter: listen.wordTypeFilter,
    sortByWordType: listen.sortByWordType,
  });

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  // Nạp lại bản nháp từ giá trị THẬT mỗi lần mở popup, rồi mới mở.
  const openSettings = () => {
    setDraft({
      rate: listen.rate,
      nextWordDelayMs: listen.nextWordDelayMs,
      repeatWordCount: listen.repeatWordCount,
      repeatBatchCount: listen.repeatBatchCount,
      batchSize: listen.batchSize,
      sleepMinutes: listen.sleepMinutes,
      wordTypeFilter: listen.wordTypeFilter,
      sortByWordType: listen.sortByWordType,
    });
    setSettingsPopupVisible(true);
  };

  // Chỉ khi bấm "Lưu cài đặt" mới thật sự ghi bản nháp vào ListenModeContext
  // (và qua đó persist AsyncStorage như logic cũ trong useListenMode.ts).
  const applyDraftAndClose = () => {
    listen.setRate(draft.rate);
    listen.setNextWordDelayMs(draft.nextWordDelayMs);
    listen.setRepeatWordCount(draft.repeatWordCount);
    listen.setRepeatBatchCount(draft.repeatBatchCount);
    listen.setBatchSize(draft.batchSize);
    listen.setSleepTimerMinutes(draft.sleepMinutes);
    listen.setWordTypeFilterDirect(draft.wordTypeFilter);
    listen.setSortByWordType(draft.sortByWordType);
    setSettingsPopupVisible(false);
  };

  const draftIncRate = () => setDraft((d) => ({ ...d, rate: Math.round(clamp(d.rate + RATE_STEP, RATE_MIN, RATE_MAX) * 100) / 100 }));
  const draftDecRate = () => setDraft((d) => ({ ...d, rate: Math.round(clamp(d.rate - RATE_STEP, RATE_MIN, RATE_MAX) * 100) / 100 }));
  const draftIncGap = () => setDraft((d) => ({ ...d, nextWordDelayMs: clamp(d.nextWordDelayMs + GAP_STEP, GAP_MIN, GAP_MAX) }));
  const draftDecGap = () => setDraft((d) => ({ ...d, nextWordDelayMs: clamp(d.nextWordDelayMs - GAP_STEP, GAP_MIN, GAP_MAX) }));
  const draftIncRepeatWord = () => setDraft((d) => ({ ...d, repeatWordCount: clamp(d.repeatWordCount + 1, REPEAT_MIN, REPEAT_MAX) }));
  const draftDecRepeatWord = () => setDraft((d) => ({ ...d, repeatWordCount: clamp(d.repeatWordCount - 1, REPEAT_MIN, REPEAT_MAX) }));
  const draftIncRepeatBatch = () => setDraft((d) => ({ ...d, repeatBatchCount: clamp(d.repeatBatchCount + 1, REPEAT_MIN, REPEAT_MAX) }));
  const draftDecRepeatBatch = () => setDraft((d) => ({ ...d, repeatBatchCount: clamp(d.repeatBatchCount - 1, REPEAT_MIN, REPEAT_MAX) }));
  const draftIncBatchSize = () => setDraft((d) => ({ ...d, batchSize: Math.max(BATCH_SIZE_MIN, d.batchSize + BATCH_SIZE_STEP) }));
  const draftDecBatchSize = () => setDraft((d) => ({ ...d, batchSize: Math.max(BATCH_SIZE_MIN, d.batchSize - BATCH_SIZE_STEP) }));
  const draftToggleWordType = (key: string) =>
    setDraft((d) => ({ ...d, wordTypeFilter: toggleWordTypeFilterKey(d.wordTypeFilter, key, listen.wordTypeGroups) }));
  const draftSelectAllWordTypes = () => setDraft((d) => ({ ...d, wordTypeFilter: null }));
  const draftToggleSort = () => setDraft((d) => ({ ...d, sortByWordType: !d.sortByWordType }));

  const word = listen.currentWord;
  const germanExample = word?.example ? getGermanExample(word.example) : '';
  const vietnameseExample = word?.example ? getVietnameseExample(word.example) : '';

  return (
    <Modal visible={listen.modalVisible} animationType="slide" onRequestClose={listen.minimize} presentationStyle="pageSheet">
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.tx }]}>
            <Icon name="headphones-alt" size={16} color={colors.tx} />{'  '}Nghe từ vựng
          </Text>
          <View style={styles.headerBtns}>
            <Pressable
              onPress={listen.minimize}
              hitSlop={8}
              style={[styles.closeBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}
            >
              <Icon name="minus" size={14} color={colors.tx2} />
            </Pressable>
            <Pressable
              onPress={listen.close}
              hitSlop={8}
              style={[styles.closeBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}
            >
              <Icon name="times" size={14} color={colors.tx2} />
            </Pressable>
          </View>
        </View>

        {!listen.words.length ? (
          <View style={styles.emptyBox}>
            <Text style={{ color: colors.tx2, fontSize: 14, textAlign: 'center' }}>
              Phiên này chưa có từ nào để nghe.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: colors.tx3, fontSize: 12.5, marginBottom: 10 }}>
              Từ {listen.origWordNumber} / {listen.origTotalWords}
              {listen.shuffle ? <>{'  ·  '}<Icon name="random" size={10} color={colors.tx3} /> ngẫu nhiên</> : ''}
              {listen.sleepRemainingSec != null ? <>{'  ·  '}<Icon name="clock" size={10} color={colors.tx3} /> còn {formatClock(listen.sleepRemainingSec)}</> : ''}
            </Text>

            <View style={[styles.progressTrack, { backgroundColor: colors.bg3 }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: accent.blue, width: `${((listen.wordIndex + 1) / Math.max(1, listen.total)) * 100}%` },
                ]}
              />
            </View>

            <View style={styles.card}>
              <PieceLine
                active={listen.pieceKind === 'word'}
                dimmed={!listen.includeWord}
                label="Từ"
                text={word ? word.originalGerman || word.mainGerman : ''}
                bigColor={colors.tx}
                labelColor={colors.tx3}
                onPress={listen.toggleIncludeWord}
              />
              <PieceLine
                active={listen.pieceKind === 'meaning'}
                dimmed={!listen.includeMeaning}
                label="Nghĩa"
                text={word?.meaning || ''}
                bigColor={accent.blue}
                labelColor={colors.tx3}
                onPress={listen.toggleIncludeMeaning}
              />
              {!!germanExample && (
                <PieceLine
                  active={listen.pieceKind === 'exampleDe'}
                  dimmed={!listen.includeExample}
                  label="Ví dụ (Đức)"
                  text={germanExample}
                  bigColor={colors.tx2}
                  labelColor={colors.tx3}
                  small
                  onPress={listen.toggleIncludeExample}
                />
              )}
              {!!vietnameseExample && (
                <PieceLine
                  active={listen.pieceKind === 'exampleVi'}
                  dimmed={!listen.includeExample}
                  label="Ví dụ (Việt)"
                  text={vietnameseExample}
                  bigColor={colors.tx2}
                  labelColor={colors.tx3}
                  small
                  onPress={listen.toggleIncludeExample}
                />
              )}
              <Text style={{ color: colors.tx3, fontSize: 10.5, textAlign: 'center', marginTop: 2 }}>
                Bấm vào từng mục để bật/tắt đọc mục đó
              </Text>
            </View>

            <View style={styles.controlsRow}>
              <Pressable
                onPress={listen.toggleShuffle}
                hitSlop={6}
                style={[
                  styles.sideToggleBtn,
                  {
                    backgroundColor: listen.shuffle ? accent.blue : colors.bg3,
                    borderColor: listen.shuffle ? accent.blue : colors.border,
                  },
                ]}
              >
                <Icon name="random" size={15} color={listen.shuffle ? '#fff' : colors.tx2} />
              </Pressable>
              <Pressable
                disabled={!listen.hasPrev}
                onPress={listen.prev}
                style={[styles.ctrlBtn, { backgroundColor: colors.bg3, borderColor: colors.border, opacity: listen.hasPrev ? 1 : 0.4 }]}
              >
                <Icon name="step-backward" size={16} color={colors.tx} />
              </Pressable>
              <Pressable
                onPress={listen.togglePlay}
                style={[styles.playBtn, { backgroundColor: accent.blue }]}
              >
                <Icon name={listen.isPlaying ? 'pause' : 'play'} size={19} color="#fff" />
              </Pressable>
              <Pressable
                disabled={!listen.hasNext}
                onPress={listen.next}
                style={[styles.ctrlBtn, { backgroundColor: colors.bg3, borderColor: colors.border, opacity: listen.hasNext ? 1 : 0.4 }]}
              >
                <Icon name="step-forward" size={16} color={colors.tx} />
              </Pressable>
              <Pressable
                onPress={openSettings}
                hitSlop={6}
                style={[styles.sideToggleBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}
              >
                <Icon name="cog" size={16} color={colors.tx2} />
              </Pressable>
            </View>

            <Text style={{ color: colors.tx3, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
              Có thể tắt màn hình, chuyển sang app khác, hoặc bấm nút thu nhỏ để tiếp tục nghe ở nền — giọng đọc sẽ tiếp tục phát.
            </Text>
          </ScrollView>
        )}
      </View>

      <BottomSheetModal visible={settingsPopupVisible} onClose={() => setSettingsPopupVisible(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Nút "Lưu" chuyển từ cuối popup (phải cuộn hết mới thấy) lên
              cùng dòng với tiêu đề, góc phải — luôn hiện sẵn ngay khi mở
              popup, không cần cuộn xuống mới lưu được. */}
          <View style={[styles.settingsHeaderRow, { marginBottom: 12 }]}>
            <Text style={[styles.title, { color: colors.tx }]}>
              <Icon name="cog" size={15} color={colors.tx} />{'  '}Cài đặt nghe
            </Text>
            <Pressable
              onPress={applyDraftAndClose}
              hitSlop={6}
              style={({ pressed }) => [
                styles.saveBtn,
                { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Icon name="check" size={11} color="#e6edf3" />
              <Text style={styles.saveBtnText}>Lưu</Text>
            </Pressable>
          </View>

          <SettingsSection title="Tốc độ" icon="tachometer-alt">
            <StepperRow label="Tốc độ đọc" valueText={`${draft.rate.toFixed(2)}x`} onDec={draftDecRate} onInc={draftIncRate} />
            <StepperRow
              label="Tốc độ sang từ tiếp theo"
              valueText={`${(draft.nextWordDelayMs / 1000).toFixed(2)}s`}
              onDec={draftDecGap}
              onInc={draftIncGap}
            />
          </SettingsSection>

          {!!listen.wordTypeGroups.length && (
            <SettingsSection title="Loại từ" icon="tag">
              <Pressable
                onPress={() => setWordTypeFilterVisible(true)}
                style={[styles.filterBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}
              >
                <Icon name="filter" size={12} color={colors.tx2} />
                <Text style={{ color: colors.tx, fontSize: 13, marginLeft: 8, flex: 1 }} numberOfLines={1}>
                  {draft.wordTypeFilter === null
                    ? `Đang nghe tất cả (${listen.wordTypeGroups.length} loại)`
                    : `Đang nghe ${draft.wordTypeFilter.length}/${listen.wordTypeGroups.length} loại`}
                </Text>
                {draft.sortByWordType && <Icon name="sort-amount-down" size={12} color={accent.blue} style={{ marginRight: 6 }} />}
                <Icon name="chevron-down" size={12} color={colors.tx3} />
              </Pressable>
            </SettingsSection>
          )}

          <SettingsSection title="Lặp lại" icon="redo">
            <StepperRow
              label="Lặp lại mỗi từ"
              valueText={`x${draft.repeatWordCount}`}
              onDec={draftDecRepeatWord}
              onInc={draftIncRepeatWord}
            />
            <StepperRow
              label="Lặp lại mỗi nhóm"
              valueText={`x${draft.repeatBatchCount}`}
              onDec={draftDecRepeatBatch}
              onInc={draftIncRepeatBatch}
            />
          </SettingsSection>

          <SettingsSection title="Chia nhóm từ" icon="box">
            <StepperRow
              label="Số từ mỗi nhóm"
              valueText={draft.batchSize === 0 ? 'Tất cả' : `${draft.batchSize} từ`}
              onDec={draftDecBatchSize}
              onInc={draftIncBatchSize}
            />
          </SettingsSection>

          <SettingsSection title="Hẹn giờ đóng" icon="clock">
            <View style={styles.chipRow}>
              {SLEEP_TIMER_PRESETS.map((m) => (
                <SleepChip
                  key={m}
                  label={m === 0 ? 'Tắt' : `${m}p`}
                  active={draft.sleepMinutes === m}
                  onPress={() => setDraft((d) => ({ ...d, sleepMinutes: m }))}
                />
              ))}
            </View>
            {listen.sleepRemainingSec != null && (
              <Text style={{ color: colors.tx3, fontSize: 11.5, marginTop: 6 }}>
                Sẽ tự dừng phát sau {formatClock(listen.sleepRemainingSec)} nữa.
              </Text>
            )}
          </SettingsSection>

          <View style={{ height: 8 }} />
        </ScrollView>
      </BottomSheetModal>

      <WordTypeFilterDropdown
        visible={wordTypeFilterVisible}
        onClose={() => setWordTypeFilterVisible(false)}
        wordTypeGroups={listen.wordTypeGroups}
        wordTypeFilter={draft.wordTypeFilter}
        onToggle={draftToggleWordType}
        onSelectAll={draftSelectAllWordTypes}
        sortByWordType={draft.sortByWordType}
        onToggleSort={draftToggleSort}
      />
    </Modal>
  );
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PieceLine({
  active,
  dimmed = false,
  label,
  text,
  bigColor,
  labelColor,
  small = false,
  onPress,
}: {
  active: boolean;
  dimmed?: boolean;
  label: string;
  text: string;
  bigColor: string;
  labelColor: string;
  small?: boolean;
  onPress?: () => void;
}) {
  if (!text) return null;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={2}
      style={[
        styles.pieceLine,
        active && { backgroundColor: 'rgba(88,166,255,0.1)', borderColor: accent.blue },
        dimmed && { opacity: 0.4 },
      ]}
    >
      <Text style={{ color: labelColor, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {active ? <><Icon name="volume-up" size={9} color={labelColor} />{' '}</> : ''}
        {label}
        {dimmed ? ' (đang tắt)' : ''}
      </Text>
      <Text style={{ color: bigColor, fontSize: small ? 14.5 : 19, fontWeight: small ? '500' : '700', marginTop: 3 }}>
        {text}
      </Text>
    </Pressable>
  );
}

/**
 * Một khối cài đặt có tiêu đề + icon riêng — dùng để chia phần "Cài đặt
 * nghe" thành từng nhóm gọn gàng, rõ ràng như màn cài đặt của 1 app nghe
 * nhạc (mp3 player) thay vì dồn hết vào 1 khối dài.
 */
function SettingsSection({ title, icon, children }: { title: string; icon: IconProps['name']; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderColor: colors.border2, backgroundColor: colors.bg2 }]}>
      <Text style={{ color: colors.tx3, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>
        <Icon name={icon} size={10} color={colors.tx3} />{'  '}{title}
      </Text>
      {children}
    </View>
  );
}

/** Chip nhỏ dùng cho các mốc hẹn giờ đóng (Tắt / 5p / 10p / ...). */
function SleepChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={[
        styles.sleepChip,
        {
          backgroundColor: active ? accent.blue : colors.bg3,
          borderColor: active ? accent.blue : colors.border,
        },
      ]}
    >
      <Text style={{ color: active ? '#fff' : colors.tx2, fontSize: 12.5, fontWeight: active ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

function StepperRow({
  label,
  valueText,
  onDec,
  onInc,
}: {
  label: string;
  valueText: string;
  onDec: () => void;
  onInc: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepperRow}>
      <Text style={{ color: colors.tx, fontSize: 13, flex: 1 }}>{label}</Text>
      <Pressable onPress={onDec} hitSlop={6} style={[styles.stepBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
        <Text style={{ color: colors.tx, fontSize: 15, fontWeight: '700' }}>−</Text>
      </Pressable>
      <Text style={{ color: colors.tx, fontSize: 13, fontWeight: '700', width: 60, textAlign: 'center' }}>{valueText}</Text>
      <Pressable onPress={onInc} hitSlop={6} style={[styles.stepBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
        <Text style={{ color: colors.tx, fontSize: 15, fontWeight: '700' }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: 4, borderRadius: 2 },
  card: { marginBottom: 16 },
  pieceLine: { borderWidth: 1.5, borderColor: 'transparent', borderRadius: 10, padding: 12, marginBottom: 8 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 },
  sideToggleBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ctrlBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  section: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  stepBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sleepChip: { borderWidth: 1, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 12 },
  // Dòng tiêu đề popup cài đặt: "Cài đặt nghe" bên trái, nút "Lưu" bên phải
  // — thay cho việc nút "Lưu" nằm tuốt dưới cùng, phải cuộn hết mới thấy.
  settingsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Nút "Lưu" cố tình dùng 1 màu tối cố định (không đổi theo theme sáng/tối
  // của app) — mục đích là 1 nút hành động nhỏ, tối giản, tương phản nhẹ
  // trên nền popup, không "hô hào" như nút full-width màu xanh lá trước đó.
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#1c2333',
  },
  saveBtnText: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2, color: '#e6edf3' },
});
