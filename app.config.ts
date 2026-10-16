// app.config.ts
import type { ExpoConfig } from "expo/config";

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: "MaidX",
  slug: "maidx",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "maidx",
  userInterfaceStyle: "automatic",

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.bulldogshot10.maidx",
  },

  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#000000",
    },
    package: "com.bulldogshot10.maidx",
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
    ],
  },

  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-asset",
    "expo-router",
    "expo-sqlite",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#000000",
      },
    ],
    "expo-audio",
    "expo-font",
    "expo-web-browser",
    "expo-secure-store",
    "expo-localization",
    [
      "expo-build-properties",
      {
        android: {},
      },
    ],
    [
      "llama.rn",
      {
        enableEntitlements: true,
        entitlementsProfile: "production",
        forceCxx20: true,
        enableOpenCLAndHexagon: true,
      },
    ],
    [
      "expo-speech-recognition",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to use the microphone.",
        speechRecognitionPermission: "Allow $(PRODUCT_NAME) to use speech recognition.",
        androidSpeechServicePackages: ["com.google.android.googlequicksearchbox", "com.google.android.tts"],
      },
    ],
    // Keeps the release signing, ABI splits and version code logic reproducible
    // across \`expo prebuild --clean\`.
    "./plugins/maid-android",
  ],

  experiments: {
    typedRoutes: true,
  },
});
