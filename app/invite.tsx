// Openflou Invite Friend Screen with QR Code
import React from 'react';
import { View, Text, StyleSheet, Pressable, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import QRCode from 'react-native-qrcode-svg';

const APP_DOWNLOAD_URL = 'https://openflou.app/download'; // Replace with actual URL

export default function InviteScreen() {
  const { colors, t, theme } = useOpenFlou();
  const router = useRouter();

  async function handleShare() {
    try {
      await Share.share({
        message: `Join me on Openflou - Secure P2P Messenger!\n\nDownload: ${APP_DOWNLOAD_URL}`,
        url: APP_DOWNLOAD_URL,
        title: 'Join Openflou',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.inviteFriend}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="group-add" size={48} color={colors.textInverted} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>{t.shareApp}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {t.scanToDownload}
        </Text>

        {/* QR Code */}
        <View style={[styles.qrContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={APP_DOWNLOAD_URL}
              size={220}
              backgroundColor={theme === 'dark' ? '#1E1E1E' : '#FFFFFF'}
              color={theme === 'dark' ? '#FFFFFF' : '#000000'}
            />
          </View>
          <Text style={[styles.urlText, { color: colors.textTertiary }]}>
            {APP_DOWNLOAD_URL}
          </Text>
        </View>

        {/* Share Button */}
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [
            styles.shareButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <MaterialIcons name="share" size={24} color={colors.textInverted} />
          <Text style={[styles.shareButtonText, { color: colors.textInverted }]}>
            Share Invitation Link
          </Text>
        </Pressable>

        {/* Features */}
        <View style={styles.features}>
          <FeatureItem
            icon="lock"
            text="End-to-End Encrypted"
            colors={colors}
          />
          <FeatureItem
            icon="hub"
            text="Peer-to-Peer Network"
            colors={colors}
          />
          <FeatureItem
            icon="cloud-off"
            text="No Central Server"
            colors={colors}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, text, colors }: { icon: keyof typeof MaterialIcons.glyphMap; text: string; colors: any }) {
  return (
    <View style={styles.featureItem}>
      <MaterialIcons name={icon} size={16} color={colors.primary} />
      <Text style={[styles.featureText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
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
    textAlign: 'center',
    includeFontPadding: false,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
    includeFontPadding: false,
  },
  qrContainer: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  urlText: {
    fontSize: 12,
    marginTop: 16,
    includeFontPadding: false,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 32,
    gap: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  features: {
    marginTop: 32,
    gap: 12,
    alignSelf: 'stretch',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    includeFontPadding: false,
  },
});
