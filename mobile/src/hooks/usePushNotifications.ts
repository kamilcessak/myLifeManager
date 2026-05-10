import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { apiClient } from '../lib/apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushRegistrationState =
  | { status: 'idle' }
  | { status: 'unsupported' }
  | { status: 'denied' }
  | { status: 'token'; expoPushToken: string }
  | { status: 'error'; message: string };

function buildExpoSubscribePayload(expoPushToken: string) {
  return {
    expoPushToken,
    platform: Platform.OS,
  };
}

/** Prosi o uprawnienia, pobiera token Expo Push i próbuje wysłać go na backend. */
async function sendExpoTokenToBackend(expoPushToken: string): Promise<void> {
  const body = buildExpoSubscribePayload(expoPushToken);
  try {
    // TODO: Backend needs to support Expo Tokens in /api/notifications/subscribe endpoint. Obecnie endpoint ten oczekuje struktury webowej.
    await apiClient.post('/notifications/subscribe', body);
  } catch {
    // Oczekiwane do czasu wsparcia Expo po stronie API — nie przerywamy działania aplikacji.
  }
}

export function usePushNotifications(enabled: boolean) {
  const [state, setState] = useState<PushRegistrationState>({ status: 'idle' });
  const sentTokenRef = useRef<string | null>(null);

  const register = useCallback(async () => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }

    if (!Device.isDevice) {
      setState({ status: 'unsupported' });
      return;
    }

    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }

    if (status !== 'granted') {
      setState({ status: 'denied' });
      return;
    }

    try {
      const projectId =
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
        (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const expoPushToken = tokenData.data;
      setState({ status: 'token', expoPushToken });

      if (sentTokenRef.current !== expoPushToken) {
        sentTokenRef.current = expoPushToken;
        await sendExpoTokenToBackend(expoPushToken);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Nie udało się pobrać tokenu push.';
      setState({ status: 'error', message });
    }
  }, [enabled]);

  useEffect(() => {
    void register();
  }, [register]);

  return { state, register };
}
