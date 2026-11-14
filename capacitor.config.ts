import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.retrostation.app',
  appName: 'Retro Station',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'retrostation.app',
    iosScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    overrideUserAgent: 'RetroStation/Capacitor',
    buildOptions: {
      keystorePath: 'debug.keystore',
      keystorePassword: 'android',
      keyAlias: 'androiddebugkey',
      keyPassword: 'android',
    },
  },
  plugins: {
    Browser: { presentationStyle: 'fullscreen' },
    Filesystem: { enabled: true },
    Preferences: { enabled: true },
    Haptics: { enabled: true },
    // Disabled: CapacitorHttp patches fetch() and fails to serialize Blob bodies for Drive uploads
    CapacitorHttp: { enabled: false },
  },
};

export default config;