import "dotenv/config";

export default {
  expo: {
    name:        "GLOOWS365E",
    slug:        "gloows365e",
    version:     "1.0.0",
    orientation: "portrait",
    icon:        "./assets/images/icon1.png",
    // Array, not a single string: "gloows365e" is the app's own deep-link
    // scheme (expo-router etc). "com.gloows365.app" (== the package/bundle
    // id below) is ALSO required — it's the redirect URI expo-auth-session's
    // Google provider hands back to the OS after sign-in
    // (`${applicationId}:/oauthredirect`, see Google.ts in expo-auth-session).
    // That package ships no config plugin to register it as an intent
    // filter/URL scheme itself, so without this entry Android/iOS have
    // nothing to open the redirect with — Google finishes auth and the
    // browser is just left showing its own page instead of handing control
    // back to the app.
    scheme:      ["gloows365e", "com.gloows365.app"],
    userInterfaceStyle: "automatic",
    newArchEnabled:     true,

    ios: {
      supportsTablet:    true,
      // FIX: was unset entirely — required before an iOS Firebase app / App
      // Store build / Google OAuth iOS client can exist. Matches the
      // Android package below, which is the common convention.
      bundleIdentifier:  "com.gloows365.app",
    },

    android: {
      adaptiveIcon: {
        backgroundColor:  "#FFFFFF",
        foregroundImage:  "./assets/images/android-icon-foreground.png",
        monochromeImage:  "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled:             true,
      predictiveBackGestureEnabled:  false,
      // FIX: was the Expo scaffold's placeholder "com.anonymous.gloows365e"
      // — replaced with a real package name before registering the app in
      // Firebase/Google Cloud Console. Testers on the old package need a
      // fresh install (Android treats a different package name as an
      // entirely different app; it can't be updated in place).
      package:                       "com.gloows365.app",
    },

    web: {
      output:  "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      "expo-web-browser",
      [
        "expo-notifications",
        {
          icon:        "./assets/images/icon1.png",
          color:       "#6366F1",
          androidMode: "default",
        },
      ],
      [
        "expo-splash-screen",
        {
          image:           "./assets/images/logo.png",
          imageWidth:      250,
          resizeMode:      "contain",
          backgroundColor: "#0f172a",
          dark: {
            backgroundColor: "#0f172a",
          },
        },
      ],
      "expo-video",
      "@react-native-community/datetimepicker",
      "react-native-compressor",
      "expo-audio",
      "expo-asset",
    ],

    experiments: {
      typedRoutes:   true,
      reactCompiler: true,
    },

    extra: {
      cfCustomerCode: process.env.EXPO_PUBLIC_CF_CUSTOMER_CODE ?? "",
      cfWorkerUrl:    process.env.EXPO_PUBLIC_CF_WORKER_URL    ?? "",
      eas: {
        projectId: "caa37b6d-6db3-4a49-9d91-a00f62b330b2",
      },
    },
  },
};