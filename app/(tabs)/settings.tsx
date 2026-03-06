// Openflou Settings Tab
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import * as storage from '@/services/storage';
import { StatusBar } from 'expo-status-bar';

export default function SettingsTab() {
  const { colors, t, theme, setTheme, language, setLanguage, currentUser, setCurrentUser, settings, updateSettings } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleLogout() {
    if (currentUser) {
      currentUser.isOnline = false;
      await storage.saveUser(currentUser);
    }
    await storage.clearAuthState();
    setCurrentUser(null);
    router.replace('/auth');
  }

  const SettingItem = ({
    icon,
    title,
    value,
    onPress,
    showChevron = true,
  }: {
    icon: keyof typeof MaterialIcons.glyphMap;
    title: string;
    value?: string;
    onPress: () => void;
    showChevron?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingItem,
        {
          backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
        },
      ]}
    >
      <View style={styles.settingLeft}>
        <MaterialIcons name={icon} size={24} color={colors.icon} />
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text>}
        {showChevron && <MaterialIcons name="chevron-right" size={24} color={colors.icon} />}
      </View>
    </Pressable>
  );

  const SettingSwitch = ({
    icon,
    title,
    value,
    onValueChange,
  }: {
    icon: keyof typeof MaterialIcons.glyphMap;
    title: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={[styles.settingItem, { backgroundColor: colors.surface }]}>
      <View style={styles.settingLeft}>
        <MaterialIcons name={icon} size={24} color={colors.icon} />
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.settings}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {/* User Profile */}
        <View style={[styles.profileSection, { backgroundColor: colors.surface }]}>
          <Avatar uri={currentUser?.avatar} username={currentUser?.username} size={64} colors={colors} />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{currentUser?.username}</Text>
            <Text style={[styles.profileStatus, { color: colors.online }]}>{t.online}</Text>
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.appearance}</Text>
          
          <SettingItem
            icon="language"
            title={t.language}
            value={language === 'en' ? 'English' : language === 'ru' ? 'Русский' : 'Українська'}
            onPress={() => {
              const langs: Array<'en' | 'ru' | 'uk'> = ['en', 'ru', 'uk'];
              const currentIndex = langs.indexOf(language);
              const nextLang = langs[(currentIndex + 1) % langs.length];
              setLanguage(nextLang);
            }}
          />
          
          {!settings.autoTheme && (
            <SettingItem
              icon="palette"
              title={t.theme}
              value={theme === 'dark' ? t.darkTheme : t.lightTheme}
              onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            />
          )}
          
          <SettingSwitch
            icon="brightness-auto"
            title={t.autoTheme}
            value={settings.autoTheme}
            onValueChange={(value) => updateSettings({ autoTheme: value })}
          />
          
          {settings.autoTheme && (
            <SettingItem
              icon="schedule"
              title={t.autoTheme}
              value={settings.autoThemeMode === 'system' ? t.followSystem : t.timeOfDay}
              onPress={() => {
                updateSettings({
                  autoThemeMode: settings.autoThemeMode === 'system' ? 'time' : 'system',
                });
              }}
            />
          )}
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.notifications}</Text>
          
          <SettingSwitch
            icon="notifications"
            title={t.notifications}
            value={settings.notifications}
            onValueChange={(value) => updateSettings({ notifications: value })}
          />
          
          <SettingSwitch
            icon="vibration"
            title="Vibration"
            value={settings.vibration}
            onValueChange={(value) => updateSettings({ vibration: value })}
          />
        </View>

        {/* Other */}
        <View style={styles.section}>
          <SettingItem
            icon="smart-toy"
            title={t.aiAssistant}
            onPress={() => router.push('/ai-assistant')}
          />
          
          <SettingItem
            icon="lock"
            title={t.privacy}
            onPress={() => showAlert('Privacy settings coming soon')}
          />
          
          <SettingItem
            icon="help"
            title={t.help}
            onPress={() => router.push('/ai-assistant')}
          />
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
            },
          ]}
        >
          <MaterialIcons name="logout" size={24} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>{t.logout}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    includeFontPadding: false,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginTop: 8,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    includeFontPadding: false,
  },
  profileStatus: {
    fontSize: 14,
    marginTop: 4,
    includeFontPadding: false,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
    includeFontPadding: false,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    marginLeft: 16,
    includeFontPadding: false,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    marginRight: 8,
    includeFontPadding: false,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 24,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
    includeFontPadding: false,
  },
});
