// Openflou Settings Tab
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Modal } from 'react-native';
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
  
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const languageNames: Record<string, string> = {
    en: 'English',
    ru: 'Русский',
    uk: 'Українська',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    pl: 'Polski',
    tr: 'Türkçe',
    ar: 'العربية',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    hi: 'हिन्दी',
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский' },
    { code: 'uk', name: 'Українська' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'pl', name: 'Polski' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'ar', name: 'العربية' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'hi', name: 'हिन्दी' },
  ];

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
        <Pressable
          onPress={() => router.push('/edit-profile')}
          style={({ pressed }) => [
            styles.profileSection,
            {
              backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
            },
          ]}
        >
          <Avatar uri={currentUser?.avatar} username={currentUser?.username} size={64} colors={colors} />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{currentUser?.username}</Text>
            <Text style={[styles.profileStatus, { color: colors.online }]}>{t.online}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.icon} />
        </Pressable>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.appearance}</Text>
          
          <SettingItem
            icon="language"
            title={t.language}
            value={languageNames[language] || 'English'}
            onPress={() => setShowLanguagePicker(true)}
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

        {/* Privacy & Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Privacy & Security</Text>
          
          <SettingItem
            icon="lock"
            title={t.privacy}
            onPress={() => router.push('/privacy')}
          />
          
          <SettingItem
            icon="devices"
            title={t.activeSessions}
            onPress={() => router.push('/sessions')}
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

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLanguagePicker(false)}
        >
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Language</Text>
            <ScrollView style={styles.languageList}>
              {languages.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => {
                    setLanguage(lang.code as any);
                    setShowLanguagePicker(false);
                  }}
                  style={({ pressed }) => [
                    styles.languageItem,
                    {
                      backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.languageName,
                      {
                        color: language === lang.code ? colors.primary : colors.text,
                        fontWeight: language === lang.code ? '600' : '400',
                      },
                    ]}
                  >
                    {lang.name}
                  </Text>
                  {language === lang.code && (
                    <MaterialIcons name="check" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    width: '80%',
    maxHeight: '70%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    includeFontPadding: false,
  },
  languageList: {
    maxHeight: 400,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  languageName: {
    fontSize: 16,
    includeFontPadding: false,
  },
});
