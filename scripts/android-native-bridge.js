import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

window.NativeAuth = Object.freeze({
  isNative: () => Capacitor.isNativePlatform(),
  addListener: (event, listener) => App.addListener(event, listener),
  addBrowserFinishedListener: (listener) => Browser.addListener('browserFinished', listener),
  getLaunchUrl: () => App.getLaunchUrl(),
  openBrowser: (url) => Browser.open({ url }),
  closeBrowser: () => Browser.close(),
});
