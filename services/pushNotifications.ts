// Openflou Push Notification Service
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';

// NOTE: setNotificationHandler is set in app/_layout.tsx — do NOT duplicate here

/**
 * Request permission and register push token with the backend.
 * Also configures Android notification channels (messages + calls).
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications: simulator — skipping token registration');
      return null;
    }

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

    if (Platform.OS === 'android') {
      // Messages channel — normal priority, sound + vibration
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5E9CF5',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Calls channel — MAX priority, full-screen intent (shows on locked screen)
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 500, 1000],
        lightColor: '#34C759',
        sound: 'default',
        enableVibrate: true,
        showBadge: false,
        bypassDnd: true,         // bypass Do Not Disturb
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({});
    const token = tokenData.data;

    if (!token) {
      console.log('Failed to get push token');
      return null;
    }

    // Save token to DB
    const supabase = getSupabaseClient();
    await supabase
      .from('openflou_users')
      .update({ push_token: token })
      .eq('id', userId);

    console.log('Push token registered:', token.slice(0, 30) + '...');
    return token;
  } catch (error) {
    console.error('Push token registration error:', error);
    return null;
  }
}

/**
 * Show incoming call notification (works on locked screen on Android via MAX channel).
 */
export async function showCallNotification(
  callerName: string,
  callType: 'voice' | 'video',
  chatId: string,
  callId: string,
  callerId: string
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call',
      body: `${callerName} is calling...`,
      data: { chatId, callId, callerId, type: callType, action: 'incoming_call' },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'calls' }),
    },
    trigger: null,
  });
  return id;
}

/**
 * Dismiss a specific call notification by its ID.
 */
export async function dismissCallNotification(notifId: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(notifId);
  } catch { /* ignore */ }
}

/**
 * Show a local notification immediately (for foreground messages).
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
        ...(Platform.OS === 'android' && { channelId: 'messages' }),
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Local notification error:', error);
  }
}

/**
 * Clear badge count.
 */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch { /* ignore */ }
}
