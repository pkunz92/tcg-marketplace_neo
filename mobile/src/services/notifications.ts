import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request push permission and register the Expo push token with the backend.
 * Call once after login.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push notifications don't work on simulators
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
    });
    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Offers',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10b981',
    });
    await Notifications.setNotificationChannelAsync('sales', {
      name: 'Sales',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#f59e0b',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Register token with backend so the server can send push notifications
  try {
    await apiClient.post('/user/push-token/', { token, platform: Platform.OS });
  } catch {
    // Non-fatal: token registration failure shouldn't break the app
  }

  return token;
}

/**
 * Schedule a local notification (for offline feedback).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  channelId = 'default',
) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // immediate
    ...(Platform.OS === 'android' ? { channelId } : {}),
  });
}
