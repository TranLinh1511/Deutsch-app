import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { mobile, accent } from '@/theme/theme';
import Icon, { IconProps } from './Icon';

/**
 * Mirrors #header on mobile (index.html):
 *  - height: --header-h (50px), padding 0 12px
 *  - left: ☰ hamburger (#mobileMenuBtn, 36x36, radius 7, bg3, border) + 🇩🇪 + "bei TL" ("TL" in accent.blue)
 *  - right: ☑️ select words, 🔍 global search, ⚙️ settings, folder-manager icon
 *  - #currentSessionLabel, .header-session-pill, .header-new-session, .header-delete-session
 *    are all hidden on mobile — intentionally NOT rendered here.
 */
interface HeaderProps {
  onOpenDrawer: () => void;
  onBulkSelect: () => void;
  onGlobalSearch: () => void;
  onSettings: () => void;
  onFolderManager: () => void;
  onListenMode: () => void;
}

export default function Header({
  onOpenDrawer,
  onBulkSelect,
  onGlobalSearch,
  onSettings,
  onFolderManager,
  onListenMode,
}: HeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.header,
        { height: mobile.headerHeight, backgroundColor: colors.bg2, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.left}>
        <Pressable
          onPress={onOpenDrawer}
          style={[
            styles.menuBtn,
            { backgroundColor: colors.bg3, borderColor: colors.border },
          ]}
        >
          <Icon name="bars" size={16} color={colors.tx} />
        </Pressable>
        <Text style={styles.flag}>🇩🇪</Text>
        <Text style={[styles.logo, { color: colors.tx }]}>
          bei <Text style={{ color: accent.blue }}>TL</Text>
        </Text>
      </View>

      <View style={styles.right}>
        <IconBtn icon="headphones-alt" onPress={onListenMode} />
        <IconBtn icon="folder-open" onPress={onFolderManager} />
        <IconBtn icon="check-square" onPress={onBulkSelect} />
        <IconBtn icon="search" onPress={onGlobalSearch} />
        <IconBtn icon="cog" onPress={onSettings} />
      </View>
    </View>
  );
}

function IconBtn({ icon, onPress }: { icon: IconProps['name']; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: colors.bg3, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name={icon} size={14} color={colors.tx} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: mobile.headerPaddingH,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuBtn: {
    width: mobile.mobileMenuBtnSize,
    height: mobile.mobileMenuBtnSize,
    borderRadius: mobile.mobileMenuBtnRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 16 },
  logo: { fontSize: 16, fontWeight: '700', fontFamily: 'Syne' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
