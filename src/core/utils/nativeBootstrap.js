/**
 * nativeBootstrap.js
 * --------------------
 * Runs once on app launch inside the Capacitor WebView to configure
 * native chrome: status bar color/style and splash screen dismissal.
 * No-ops gracefully on plain web so the same App.jsx works in both
 * `npm run dev` (browser) and the compiled APK.
 */
export async function bootstrapNativeShell() {
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
  if (!isNative) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#15110D' });
  } catch {
    /* status bar plugin not available */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* splash screen plugin not available */
  }
}
