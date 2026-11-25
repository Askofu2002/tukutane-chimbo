import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "tz.tukutanechimbo.app",
  appName: "Tukutane Chimbo",
  webDir: "public",
  server: {
    url: "https://tukutane-chimbo.vercel.app",
    cleartext: false,
    androidScheme: "https"
  },
  android: { allowMixedContent: false }
};

export default config;
