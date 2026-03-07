// Openflou Privacy Settings Screen
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

interface PrivacySettings {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  about: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  groupsInvite: 'everyone' | 'contacts';
  channelsInvite: 'everyone' | 'contacts';
  blockedUsers: string[];
}

export default function PrivacyScreen() {
  const { colors, t, theme } = useOpenFlou();
  const router = useRouter();

  const [privacy, setPrivacy] = useState<PrivacySettings>({
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    about: 'everyone',
    readReceipts: true,
    groupsInvite: 'everyone',
    channelsInvite: 'everyone',
    blockedUsers: [],
  });

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'My Contacts' },
    { value: 'nobody', label: 'Nobody' },
  ];

  const groupOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'My Contacts' },
  ];

  const PrivacyItem = ({
    icon,
    title,
    description,
    value,
    options,
    onPress,
  }: {
    icon: keyof typeof MaterialIcons.glyphMap;
    title: string;
    description: string;
    value: string;
    options: { value: string; label: string }[];
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.privacyItem,
        {
          backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
        },
      ]}
    >
      <View style={styles.privacyLeft}>
        <MaterialIcons name={icon} size={24} color={colors.icon} />
        <View style={styles.privacyTextContainer}>
          <Text style={[styles.privacyTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.privacyDescription, { color: colors.textSecondary }]}>{description}</Text>
        </View>
      </View>
      <View style={styles.privacyRight}>
        <Text style={[styles.privacyValue, { color: colors.textSecondary }]}>
          {options.find((o) => o.value === value)?.label}
        </Text>
        <MaterialIcons name="chevron-right" size={24} color={colors.icon} />
      </View>
    </Pressable>
  );

  const PrivacySwitch = ({
    icon,
    title,
    description,
    value,
    onValueChange,
  }: {
    icon: keyof typeof MaterialIcons.glyphMap;
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={[styles.privacyItem, { backgroundColor: colors.surface }]}>
      <View style={styles.privacyLeft}>
        <MaterialIcons name={icon} size={24} color={colors.icon} />
        <View style={styles.privacyTextContainer}>
          <Text style={[styles.privacyTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.privacyDescription, { color: colors.textSecondary }]}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );

  const cycleOption = (
    key: keyof Pick<PrivacySettings, 'lastSeen' | 'profilePhoto' | 'about'>,
    options: { value: string; label: string }[]
  ) => {
    const currentIndex = options.findIndex((o) => o.value === privacy[key]);
    const nextIndex = (currentIndex + 1) % options.length;
    setPrivacy({ ...privacy, [key]: options[nextIndex].value });
  };

  const cycleGroupOption = (
    key: keyof Pick<PrivacySettings, 'groupsInvite' | 'channelsInvite'>
  ) => {
    const options = groupOptions;
    const currentIndex = options.findIndex((o) => o.value === privacy[key]);
    const nextIndex = (currentIndex + 1) % options.length;
    setPrivacy({ ...privacy, [key]: options[nextIndex].value as 'everyone' | 'contacts' });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView>
        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WHO CAN SEE MY PERSONAL INFO</Text>

          <PrivacyItem
            icon="access-time"
            title="Last Seen & Online"
            description="Who can see when you were last online"
            value={privacy.lastSeen}
            options={privacyOptions}
            onPress={() => cycleOption('lastSeen', privacyOptions)}
          />

          <PrivacyItem
            icon="account-circle"
            title="Profile Photo"
            description="Who can see your profile photo"
            value={privacy.profilePhoto}
            options={privacyOptions}
            onPress={() => cycleOption('profilePhoto', privacyOptions)}
          />

          <PrivacyItem
            icon="info"
            title="About"
            description="Who can see your bio information"
            value={privacy.about}
            options={privacyOptions}
            onPress={() => cycleOption('about', privacyOptions)}
          />
        </View>

        {/* Messaging Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MESSAGING</Text>

          <PrivacySwitch
            icon="done-all"
            title="Read Receipts"
            description="Send read receipts when you read messages"
            value={privacy.readReceipts}
            onValueChange={(value) => setPrivacy({ ...privacy, readReceipts: value })}
          />
        </View>

        {/* Groups & Channels Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GROUPS & CHANNELS</Text>

          <PrivacyItem
            icon="group"
            title="Groups"
            description="Who can add you to groups"
            value={privacy.groupsInvite}
            options={groupOptions}
            onPress={() => cycleGroupOption('groupsInvite')}
          />

          <PrivacyItem
            icon="campaign"
            title="Channels"
            description="Who can add you to channels"
            value={privacy.channelsInvite}
            options={groupOptions}
            onPress={() => cycleGroupOption('channelsInvite')}
          />
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SECURITY</Text>

          <Pressable
            onPress={() => router.push('/telegram-link')}
            style={({ pressed }) => [
              styles.privacyItem,
              {
                backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
              },
            ]}
          >
            <View style={styles.privacyLeft}>
              <MaterialIcons name="send" size={24} color={colors.primary} />
              <View style={styles.privacyTextContainer}>
                <Text style={[styles.privacyTitle, { color: colors.text }]}>Telegram Account</Text>
                <Text style={[styles.privacyDescription, { color: colors.textSecondary }]}>Optional recovery method</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.icon} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/blocked-users')}
            style={({ pressed }) => [
              styles.privacyItem,
              {
                backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
              },
            ]}
          >
            <View style={styles.privacyLeft}>
              <MaterialIcons name="block" size={24} color={colors.error} />
              <View style={styles.privacyTextContainer}>
                <Text style={[styles.privacyTitle, { color: colors.text }]}>Blocked Users</Text>
                <Text style={[styles.privacyDescription, { color: colors.textSecondary }]}>
                  {privacy.blockedUsers.length} users blocked
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.icon} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
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
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
  },
  privacyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  privacyTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '500',
    includeFontPadding: false,
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 18,
  },
  privacyRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyValue: {
    fontSize: 14,
    marginRight: 8,
    includeFontPadding: false,
  },
});
