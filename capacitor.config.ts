import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.santi.fitnessapp',
  appName: 'CARGA',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  // Solo configuramos plugins que ya son dependencia del proyecto
  // (@capacitor/status-bar). No se añade @capacitor/splash-screen porque
  // no está instalado.
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
