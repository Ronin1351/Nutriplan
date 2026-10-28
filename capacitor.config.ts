import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutriplan.app',
  appName: 'Nutriplan',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
