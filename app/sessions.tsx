// Openflou Active Sessions Screen
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as api from '@/services/api';

interface Session {
  id: string;
  device_name: string;
  device_type: string;
  platform: string;
  ip_address: string;
  last_active: string;
  created_at: string;
}

export default function SessionsScreen() {
  const { colors, t, theme, currentUser } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    if (!currentUser) return;
    
    const { sessions: data, error } = await api.getSessions(currentUser.id);
    
    if (error) {
      showAlert('Error loading sessions');
      return;
    }
    
    // Получаем текущее устройство
    const currentDevice = Device.deviceName || 'Unknown Device';
    
    // Сортируем: текущее устройство первое
    const sorted = data.sort((a, b) => {
      if (a.device_name === currentDevice) return -1;
      if (b.device_name === currentDevice) return 1;
      return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
    });
    
    setSessions(sorted);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }

  async function handleTerminateSession(sessionId: string) {
    const { error } = await api.deleteSession(sessionId);
    
    if (error) {
      showAlert('Error terminating session');
      return;
    }
    
    showAlert('Session terminated');
    loadSessions();
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  function getDeviceIcon(platform: string): keyof typeof MaterialIcons.glyphMap {
    const p = platform.toLowerCase();
    if (p.includes('ios')) return 'phone-iphone';
    if (p.includes('android')) return 'phone-android';
    if (p.includes('windows')) return 'computer';
    if (p.includes('mac')) return 'laptop-mac';
    return 'devices';
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Active Sessions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Info */}
        <View style={styles.infoContainer}>
          <MaterialIcons name="info-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            These are the devices currently logged into your account. Terminate any sessions you don't recognize.
          </Text>
        </View>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="devices" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active sessions</Text>
          </View>
        ) : (
          sessions.map((session, index) => (
            <View
              key={session.id}
              style={[
                styles.sessionItem,
                {
                  backgroundColor: colors.surface,
                  borderBottomWidth: index === sessions.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={styles.sessionLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
                  <MaterialIcons name={getDeviceIcon(session.platform)} size={24} color={colors.primary} />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={[styles.deviceName, { color: colors.text }]}>
                    {session.device_name || 'Unknown Device'}
                  </Text>
                  <Text style={[styles.deviceType, { color: colors.textSecondary }]}>
                    {session.device_type || 'Unknown Model'}
                  </Text>
                  <View style={styles.sessionMeta}>
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                      {session.platform} • {session.ip_address}
                    </Text>
                  </View>
                  <Text style={[styles.lastActive, { color: colors.textTertiary }]}>
                    Last active: {formatDate(session.last_active)}
                  </Text>
                </View>
              </View>
              
              <Pressable
                onPress={() => {
                  showAlert(
                    'Terminate Session?',
                    'This device will be logged out immediately.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Terminate',
                        style: 'destructive',
                        onPress: () => handleTerminateSession(session.id),
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [
                  styles.terminateButton,
                  {
                    backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                  },
                ]}
              >
                <MaterialIcons name="close" size={20} color={colors.error} />
              </Pressable>
            </View>
          ))
        )}

        {/* Terminate All */}
        {sessions.length > 1 && (
          <Pressable
            onPress={() => {
              showAlert(
                'Terminate All Other Sessions?',
                'All devices except this one will be logged out.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Terminate All',
                    style: 'destructive',
                    onPress: async () => {
                      for (const session of sessions.slice(1)) {
                        await api.deleteSession(session.id);
                      }
                      showAlert('All sessions terminated');
                      loadSessions();
                    },
                  },
                ]
              );
            }}
            style={({ pressed }) => [
              styles.terminateAllButton,
              {
                backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
              },
            ]}
          >
            <MaterialIcons name="delete-sweep" size={24} color={colors.error} />
            <Text style={[styles.terminateAllText, { color: colors.error }]}>
              Terminate All Other Sessions
            </Text>
          </Pressable>
        )}
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
  infoContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
    includeFontPadding: false,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 14,
    includeFontPadding: false,
    marginBottom: 4,
  },
  sessionMeta: {
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    includeFontPadding: false,
  },
  lastActive: {
    fontSize: 12,
    includeFontPadding: false,
  },
  terminateButton: {
    padding: 8,
    borderRadius: 8,
  },
  terminateAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  terminateAllText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
