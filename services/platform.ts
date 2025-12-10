import { Capacitor } from '@capacitor/core';

export const isElectron = !!window.electronAPI?.isElectron;
export const isCapacitor = Capacitor.isNativePlatform();
export const isWeb = !isElectron && !isCapacitor;
