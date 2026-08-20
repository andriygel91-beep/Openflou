// Openflou Privacy & Security Settings
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface PrivacySettings {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  about: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  groupsInvite: 'everyone' | 'contacts';
  channelsInvite: 'everyone' | 'contacts';
}

export default function PrivacyScreen() {
  const { colors, t, theme, currentUser, updateUser } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [privacy, setPrivacy] = useState<PrivacySettings>({
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    about: 'everyone',
    readReceipts: true,
    groupsInvite: 'everyone',
    channelsInvite: 'everyone',
  });

  // Change Password modal
  const [showPassModal, setShowPassModal] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // Change Username modal
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'My Contacts' },
    { value: 'nobody', label: 'Nobody' },
  ];
  const groupOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'My Contacts' },
  ];

  async function handleChangePassword() {
    if (!currentPass.trim() || !newPass.trim() || !confirmPass.trim()) {
      showAlert('Please fill all fields'); return;
    }
    if (newPass.length < 6) {
      showAlert('New password must be at least 6 characters'); return;
    }
    if (newPass !== confirmPass) {
      showAlert('Passwords do not match'); return;
    }
    if (!currentUser) return;
    setPassLoading(true);
    try {
      // Verify current password by attempting sign-in
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('openflou-auth', {
        body: { action: 'signin', username: currentUser.username, password: currentPass },
      });
      if (verifyErr || verifyData?.error) {
        showAlert('Current password is incorrect'); setPassLoading(false); return;
      }

      // Hash new password and update
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: {
          action: 'change_password',
          userId: currentUser.id,
          currentPassword: currentPass,
          newPassword: newPass,
        },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = (await error.context?.text()) || msg; } catch {}
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      showAlert('Success', 'Password changed successfully!');
      setShowPassModal(false);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to change password');
    } finally {
      setPassLoading(false);
    }
  }

  async function handleChangeUsername() {
    if (!newUsername.trim()) { showAlert('Enter a username'); return; }
    if (newUsername.length < 3) { showAlert('Username must be at least 3 characters'); return; }
    if (!/^[a-z0-9_]+$/i.test(newUsername)) {
      showAlert('Username can only contain letters, numbers and underscores'); return;
    }
    if (!currentUser) return;
    setUsernameLoading(true);
    try {
      // Check if username is taken
      const { data: existing } = await supabase
        .from('openflou_users')
        .select('id')
        .eq('username', newUsername.toLowerCase())
        .neq('id', currentUser.id)
        .maybeSingle();
      if (existing) { showAlert('Username already taken'); setUsernameLoading(false); return; }

      const updates: any = { username: newUsername.toLowerCase() };
      if (newDisplayName.trim()) updates.display_name = newDisplayName.trim();

      const { error } = await supabase.from('openflou_users').update(updates).eq('id', currentUser.id);
      if (error) throw error;

      await updateUser({ ...currentUser, username: newUsername.toLowerCase(), ...((newDisplayName.trim() ? { display_name: newDisplayName.trim() } : {})) } as any);
      showAlert('Success', 'Username updated!');
      setShowUsernameModal(false);
      setNewUsername(''); setNewDisplayName('');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to change username');
    } finally {
      setUsernameLoading(false);
    }
  }

  const cycleOption = (key: keyof Pick<PrivacySettings, 'lastSeen' | 'profilePhoto' | 'about'>, options: { value: string; label: string }[]) => {
    const idx = options.findIndex((o) => o.value === privacy[key]);
    setPrivacy({ ...privacy, [key]: options[(idx + 1) % options.length].value as any });
  };
  const cycleGroupOption = (key: keyof Pick<PrivacySettings, 'groupsInvite' | 'channelsInvite'>) => {
    const idx = groupOptions.findIndex((o) => o.value === privacy[key]);
    setPrivacy({ ...privacy, [key]: groupOptions[(idx + 1) % groupOptions.length].value as any });
  };

  const Row = ({ icon, iconColor, title, desc, right, onPress }: {
    icon: keyof typeof MaterialIcons.glyphMap; iconColor?: string;
    title: string; desc?: string; right?: React.ReactNode; onPress?: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceSecondary : colors.surface }]}
    >
      <View style={[styles.iconBox, { backgroundColor: (iconColor || colors.primary) + '20' }]}>
        <MaterialIcons name={icon} size={20} color={iconColor || colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {desc ? <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>{desc}</Text> : null}
      </View>
      {right}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACCOUNT</Text>

          <Row
            icon="lock"
            iconColor="#5E9CF5"
            title="Change Password"
            desc="Update your account password"
            onPress={() => setShowPassModal(true)}
            right={<MaterialIcons name="chevron-right" size={22} color={colors.icon} />}
          />

          <View style={[styles.separator, { backgroundColor: colors.divider }]} />

          <Row
            icon="alternate-email"
            iconColor="#34C759"
            title="Change Username / Display Name"
            desc={currentUser ? `@${currentUser.username}` : ''}
            onPress={() => {
              setNewUsername(currentUser?.username || '');
              setNewDisplayName((currentUser as any)?.display_name || '');
              setShowUsernameModal(true);
            }}
            right={<MaterialIcons name="chevron-right" size={22} color={colors.icon} />}
          />
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHO CAN SEE MY INFO</Text>

          <Row
            icon="access-time"
            iconColor={colors.icon}
            title="Last Seen & Online"
            desc="Who can see when you were last online"
            onPress={() => cycleOption('lastSeen', privacyOptions)}
            right={
              <View style={styles.valueRow}>
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {privacyOptions.find((o) => o.value === privacy.lastSeen)?.label}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.icon} />
              </View>
            }
          />
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <Row
            icon="account-circle"
            iconColor={colors.icon}
            title="Profile Photo"
            desc="Who can see your profile photo"
            onPress={() => cycleOption('profilePhoto', privacyOptions)}
            right={
              <View style={styles.valueRow}>
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {privacyOptions.find((o) => o.value === privacy.profilePhoto)?.label}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.icon} />
              </View>
            }
          />
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <Row
            icon="info"
            iconColor={colors.icon}
            title="About"
            desc="Who can see your bio"
            onPress={() => cycleOption('about', privacyOptions)}
            right={
              <View style={styles.valueRow}>
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {privacyOptions.find((o) => o.value === privacy.about)?.label}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.icon} />
              </View>
            }
          />
        </View>

        {/* Messaging */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>MESSAGING</Text>
          <View style={[styles.row, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.icon + '20' }]}>
              <MaterialIcons name="done-all" size={20} color={colors.icon} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Read Receipts</Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>Send read receipts when you read messages</Text>
            </View>
            <Switch
              value={privacy.readReceipts}
              onValueChange={(v) => setPrivacy({ ...privacy, readReceipts: v })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Groups */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GROUPS & CHANNELS</Text>
          <Row
            icon="group"
            iconColor={colors.icon}
            title="Groups"
            desc="Who can add you to groups"
            onPress={() => cycleGroupOption('groupsInvite')}
            right={
              <View style={styles.valueRow}>
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {groupOptions.find((o) => o.value === privacy.groupsInvite)?.label}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.icon} />
              </View>
            }
          />
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <Row
            icon="campaign"
            iconColor={colors.icon}
            title="Channels"
            desc="Who can add you to channels"
            onPress={() => cycleGroupOption('channelsInvite')}
            right={
              <View style={styles.valueRow}>
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {groupOptions.find((o) => o.value === privacy.channelsInvite)?.label}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.icon} />
              </View>
            }
          />
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SECURITY</Text>
          <Row
            icon="send"
            iconColor="#229ED9"
            title="Telegram Account"
            desc="Optional recovery method"
            onPress={() => router.push('/telegram-link')}
            right={<MaterialIcons name="chevron-right" size={22} color={colors.icon} />}
          />
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <Row
            icon="devices"
            iconColor="#FF9500"
            title="Active Sessions"
            desc="Manage your logged-in devices"
            onPress={() => router.push('/sessions')}
            right={<MaterialIcons name="chevron-right" size={22} color={colors.icon} />}
          />
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <Row
            icon="block"
            iconColor={colors.error}
            title="Blocked Users"
            desc="Manage blocked contacts"
            onPress={() => router.push('/blocked-users')}
            right={<MaterialIcons name="chevron-right" size={22} color={colors.icon} />}
          />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Change Password Modal ── */}
      <Modal visible={showPassModal} transparent animationType="slide" onRequestClose={() => !passLoading && setShowPassModal(false)}>
        <Pressable style={styles.overlay} onPress={() => !passLoading && setShowPassModal(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Change Password</Text>

            <View style={[styles.inputWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialIcons name="lock-outline" size={20} color={colors.icon} />
              <TextInput
                value={currentPass}
                onChangeText={setCurrentPass}
                placeholder="Current password"
                placeholderTextColor={colors.textTertiary}
                style={[styles.sheetInput, { color: colors.text }]}
                secureTextEntry
                autoCapitalize="none"
                editable={!passLoading}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialIcons name="lock" size={20} color={colors.icon} />
              <TextInput
                value={newPass}
                onChangeText={setNewPass}
                placeholder="New password (min 6 chars)"
                placeholderTextColor={colors.textTertiary}
                style={[styles.sheetInput, { color: colors.text }]}
                secureTextEntry
                autoCapitalize="none"
                editable={!passLoading}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialIcons name="lock" size={20} color={colors.icon} />
              <TextInput
                value={confirmPass}
                onChangeText={setConfirmPass}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textTertiary}
                style={[styles.sheetInput, { color: colors.text }]}
                secureTextEntry
                autoCapitalize="none"
                editable={!passLoading}
              />
            </View>

            <View style={styles.btnRow}>
              <Pressable
                onPress={() => setShowPassModal(false)}
                disabled={passLoading}
                style={[styles.sheetBtn, { backgroundColor: colors.surfaceSecondary }]}
              >
                <Text style={[styles.sheetBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleChangePassword}
                disabled={passLoading}
                style={[styles.sheetBtn, { backgroundColor: colors.primary, opacity: passLoading ? 0.7 : 1 }]}
              >
                {passLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.sheetBtnText, { color: '#fff' }]}>Save</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Change Username Modal ── */}
      <Modal visible={showUsernameModal} transparent animationType="slide" onRequestClose={() => !usernameLoading && setShowUsernameModal(false)}>
        <Pressable style={styles.overlay} onPress={() => !usernameLoading && setShowUsernameModal(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Change Username</Text>

            <View style={[styles.inputWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialIcons name="alternate-email" size={20} color={colors.icon} />
              <TextInput
                value={newUsername}
                onChangeText={(v) => setNewUsername(v.toLowerCase())}
                placeholder="New username (a-z 0-9 _)"
                placeholderTextColor={colors.textTertiary}
                style={[styles.sheetInput, { color: colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!usernameLoading}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialIcons name="person" size={20} color={colors.icon} />
              <TextInput
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                placeholder="Display name (optional)"
                placeholderTextColor={colors.textTertiary}
                style={[styles.sheetInput, { color: colors.text }]}
                editable={!usernameLoading}
              />
            </View>

            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Username must be 3–32 characters. Letters, digits and underscores only.
            </Text>

            <View style={styles.btnRow}>
              <Pressable
                onPress={() => setShowUsernameModal(false)}
                disabled={usernameLoading}
                style={[styles.sheetBtn, { backgroundColor: colors.surfaceSecondary }]}
              >
                <Text style={[styles.sheetBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleChangeUsername}
                disabled={usernameLoading}
                style={[styles.sheetBtn, { backgroundColor: colors.primary, opacity: usernameLoading ? 0.7 : 1 }]}
              >
                {usernameLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.sheetBtnText, { color: '#fff' }]}>Save</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', marginLeft: 8, includeFontPadding: false },
  section: { marginTop: 24 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
    paddingHorizontal: 16, marginBottom: 6, includeFontPadding: false, letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 64,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '500', includeFontPadding: false },
  rowDesc: { fontSize: 13, includeFontPadding: false, marginTop: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  valueText: { fontSize: 14, marginRight: 4, includeFontPadding: false },
  separator: { height: 1, marginLeft: 66 },
  // Modal/Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', includeFontPadding: false, marginBottom: 20 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, height: 52, marginBottom: 12, gap: 10,
  },
  sheetInput: { flex: 1, fontSize: 16, includeFontPadding: false },
  hint: { fontSize: 12, includeFontPadding: false, lineHeight: 18, marginBottom: 20, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  sheetBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sheetBtnText: { fontSize: 16, fontWeight: '600', includeFontPadding: false },
});
