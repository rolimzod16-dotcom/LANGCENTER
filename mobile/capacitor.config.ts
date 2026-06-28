import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.langcenter.app",
  appName: "Lang Center",
  webDir: "www",
  server: {
    url: "https://langcenter.vercel.app/app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#4f46e5",
  },
};

export default config;