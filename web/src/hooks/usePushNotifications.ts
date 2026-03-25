import { useCallback, useEffect, useState } from 'react';
import { notificationsApi } from '../lib/api';

type PushState = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'loading';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushState>('loading');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PushState);

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setIsSubscribed(!!sub);
      })
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    try {
      setPermission('loading');

      const perm = await Notification.requestPermission();
      setPermission(perm as PushState);
      if (perm !== 'granted') return;

      const { data: vapidRes } = await notificationsApi.getVapidPublicKey();
      const vapidPublicKey = vapidRes.data.key;

      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
      }

      await notificationsApi.subscribe(subscription.toJSON());
      setIsSubscribed(true);
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await notificationsApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
    }
  }, []);

  return { permission, isSubscribed, subscribe, unsubscribe };
}
