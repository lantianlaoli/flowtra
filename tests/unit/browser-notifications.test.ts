import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermissionIfNeeded,
  sendBrowserNotification
} from '@/lib/browser-notifications';

type NotificationCtorMock = {
  (title: string, options?: NotificationOptions & { renotify?: boolean }): Notification;
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  calls: Array<{ title: string; options?: NotificationOptions & { renotify?: boolean } }>;
};

const createNotificationMock = (permission: NotificationPermission = 'default'): NotificationCtorMock => {
  const calls: Array<{ title: string; options?: NotificationOptions & { renotify?: boolean } }> = [];

  const NotificationMock = (function NotificationMock(
    title: string,
    options?: NotificationOptions & { renotify?: boolean }
  ) {
    calls.push({ title, options });
    return {} as Notification;
  }) as unknown as NotificationCtorMock;

  NotificationMock.permission = permission;
  NotificationMock.calls = calls;
  NotificationMock.requestPermission = async () => NotificationMock.permission;

  return NotificationMock;
};

const restoreWindow = (originalWindow: typeof globalThis.window | undefined) => {
  const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis.window };
  if (originalWindow === undefined) {
    delete globalWithWindow.window;
    return;
  }

  globalWithWindow.window = originalWindow;
};

test('unsupported environment returns unsupported permission and no-op send', async () => {
  const originalWindow = globalThis.window;
  const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis.window };
  delete globalWithWindow.window;

  try {
    assert.equal(isNotificationSupported(), false);
    assert.equal(getNotificationPermission(), 'unsupported');
    assert.equal(await requestNotificationPermissionIfNeeded(), 'unsupported');

    assert.doesNotThrow(() => {
      sendBrowserNotification({
        title: 'Image generation started',
        body: 'Project Agent: Avatar Ads',
        tag: 'agent-avatar-image-start'
      });
    });
  } finally {
    restoreWindow(originalWindow);
  }
});

test('permission default requests once and returns granted', async () => {
  const originalWindow = globalThis.window;
  const NotificationMock = createNotificationMock('default');
  let requestCount = 0;

  NotificationMock.requestPermission = async () => {
    requestCount += 1;
    NotificationMock.permission = 'granted';
    return 'granted';
  };

  const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis.window };
  globalWithWindow.window = { Notification: NotificationMock } as unknown as typeof globalThis.window;

  try {
    const result = await requestNotificationPermissionIfNeeded();
    assert.equal(result, 'granted');
    assert.equal(requestCount, 1);
  } finally {
    restoreWindow(originalWindow);
  }
});

test('sendBrowserNotification does not throw when permission is denied', () => {
  const originalWindow = globalThis.window;
  const NotificationMock = createNotificationMock('denied');

  const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis.window };
  globalWithWindow.window = { Notification: NotificationMock } as unknown as typeof globalThis.window;

  try {
    assert.doesNotThrow(() => {
      sendBrowserNotification({
        title: 'Generation failed',
        body: 'Project Agent: Clone Workflow',
        tag: 'agent-clone-failed'
      });
    });
    assert.equal(NotificationMock.calls.length, 0);
  } finally {
    restoreWindow(originalWindow);
  }
});

test('sendBrowserNotification forwards tag and renotify false to browser api', () => {
  const originalWindow = globalThis.window;
  const NotificationMock = createNotificationMock('granted');

  const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis.window };
  globalWithWindow.window = { Notification: NotificationMock } as unknown as typeof globalThis.window;

  try {
    sendBrowserNotification({
      title: 'Your video is ready',
      body: 'Project Agent: Clone Workflow',
      tag: 'agent-clone-completed'
    });

    assert.equal(NotificationMock.calls.length, 1);
    assert.equal(NotificationMock.calls[0].title, 'Your video is ready');
    assert.equal(NotificationMock.calls[0].options?.tag, 'agent-clone-completed');
    assert.equal(NotificationMock.calls[0].options?.renotify, false);
  } finally {
    restoreWindow(originalWindow);
  }
});
