// Openflou Push Notification Service
// Registers Expo push tokens and schedules local notifications
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permission and register push token with the backend
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications not available on simulator');
      return null;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4A90D9',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500],
        lightColor: '#22c55e',
        sound: 'default',
        enableVibrate: true,
        showBadge: false,
      });
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses app.json projectId if set
    });
    const token = tokenData.data;

    if (!token) {
      console.log('Failed to get push token');
      return null;
    }

    // Store token in DB
    const supabase = getSupabaseClient();
    await supabase
      .from('openflou_users')
      .update({ push_token: token })
      .eq('id', userId);

    console.log('Push token registered:', token.slice(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('Push token registration error:', error);
    return null;
  }
}

/**
 * Show a local notification immediately (for foreground messages)
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        badge: 1,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Local notification error:', error);
  }
}

/**
 * Clear badge count
 */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch { /* ignore */ }
}

/**
 * Add notification response listener (when user taps notification)
 */
export function addNotificationResponseListener(
  handler: (chatId: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const chatId = response.notification.request.content.data?.chatId as string;
    if (chatId) {
      handler(chatId);
    }
  });
  return () => subscription.remove();
}
