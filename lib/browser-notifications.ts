export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

interface BrowserNotificationPayload {
  title: string;
  body: string;
  tag: string;
  data?: Record<string, unknown>;
}

type BrowserNotificationOptions = NotificationOptions & {
  renotify?: boolean;
};

const getNotificationApi = () => {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;
  return window.Notification;
};

export const isNotificationSupported = (): boolean => {
  return Boolean(getNotificationApi());
};

export const getNotificationPermission = (): BrowserNotificationPermission => {
  const NotificationApi = getNotificationApi();
  if (!NotificationApi) return 'unsupported';
  return NotificationApi.permission;
};

export const requestNotificationPermissionIfNeeded = async (): Promise<BrowserNotificationPermission> => {
  const NotificationApi = getNotificationApi();
  if (!NotificationApi) return 'unsupported';

  if (NotificationApi.permission !== 'default') {
    return NotificationApi.permission;
  }

  try {
    const permission = await NotificationApi.requestPermission();
    return permission;
  } catch {
    return NotificationApi.permission;
  }
};

export const sendBrowserNotification = ({ title, body, tag, data }: BrowserNotificationPayload): void => {
  const NotificationApi = getNotificationApi();
  if (!NotificationApi) return;
  if (NotificationApi.permission !== 'granted') return;

  try {
    // tag enables replacement behavior for repeated events of same type.
    const options: BrowserNotificationOptions = {
      body,
      tag,
      data,
      renotify: false
    };
    new NotificationApi(title, {
      ...options
    });
  } catch {
    // Keep notifications best-effort and never block UI flow.
  }
};
