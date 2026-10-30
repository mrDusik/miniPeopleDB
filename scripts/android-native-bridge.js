import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { createPushRegistrationLifecycle, validatePushAction } from '../src/android-push-client.js';

window.NativeAuth = Object.freeze({
  isNative: () => Capacitor.isNativePlatform(),
  addListener: (event, listener) => App.addListener(event, listener),
  addBrowserFinishedListener: (listener) => Browser.addListener('browserFinished', listener),
  getLaunchUrl: () => App.getLaunchUrl(),
  openBrowser: (url) => Browser.open({ url }),
  closeBrowser: () => Browser.close(),
});

window.NativePush = Object.freeze({
  isNative: () => Capacitor.isNativePlatform(),
  createRegistrationLifecycle: () => createPushRegistrationLifecycle({
    apiUrl: (path) => {
      const base = window.MINIPEOPLEDB_API_BASE_URL;
      return base ? new URL(path, base).toString() : path;
    },
  }),
  validateAction: validatePushAction,
  addListener: (event, listener) => PushNotifications.addListener(event, listener),
  checkPermissions: () => PushNotifications.checkPermissions(),
  requestPermissions: () => PushNotifications.requestPermissions(),
  createChannel: () => PushNotifications.createChannel({
    id: 'mini-people-notifications',
    name: 'Notificaciones de MiniPeopleDB',
    description: 'Avisos de la bandeja de notificaciones.',
    importance: 4,
    visibility: 0,
    vibration: true,
    lights: false,
  }),
  register: () => PushNotifications.register(),
});
