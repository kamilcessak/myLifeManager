import webpush from 'web-push';

const PUBLIC_VAPID_KEY = process.env.PUBLIC_VAPID_KEY;
const PRIVATE_VAPID_KEY = process.env.PRIVATE_VAPID_KEY;

if (!PUBLIC_VAPID_KEY || !PRIVATE_VAPID_KEY) {
  console.warn(
    '⚠️  VAPID keys not set. Push notifications will be disabled.\n' +
    '   Generate keys with: npx web-push generate-vapid-keys\n' +
    '   Then add PUBLIC_VAPID_KEY and PRIVATE_VAPID_KEY to your .env file.',
  );
}

if (PUBLIC_VAPID_KEY && PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@mylifemanager.app'}`,
    PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY,
  );
}

export { webpush, PUBLIC_VAPID_KEY };
