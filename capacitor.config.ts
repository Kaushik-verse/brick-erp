import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brickworks.erp',
  appName: 'Brick ERP',
  webDir: 'dist',
  backgroundColor: '#15110D',
  android: {
    backgroundColor: '#15110D',
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#15110D',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#15110D',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    GoogleAuth: {
      scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
      serverClientId: '813773523036-4vo5qijl8uvtdqsd83qb5c7c7j9hth0u.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
