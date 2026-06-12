import "dotenv/config";

export default {
  expo: {
    name:        "GLOOWS365E",
    slug:        "gloows365e",
    version:     "1.0.0",
    orientation: "portrait",
    icon:        "./assets/images/icon1.png",
    scheme:      "gloows365e",
    userInterfaceStyle: "automatic",
    newArchEnabled:     true,

    ios: {
      supportsTablet: true,
    },

    android: {
      adaptiveIcon: {
        backgroundColor:  "#E6F4FE",
        foregroundImage:  "./assets/images/android-icon-foreground.png",
        backgroundImage:  "./assets/images/android-icon-background.png",
        monochromeImage:  "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled:             true,
      predictiveBackGestureEnabled:  false,
      package:                       "com.anonymous.gloows365e",
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
    ],

    experiments: {
      typedRoutes:   true,
      reactCompiler: true,
    },

    extra: {
      cfCustomerCode: process.env.EXPO_PUBLIC_CF_CUSTOMER_CODE ?? "",
      cfWorkerUrl:    process.env.EXPO_PUBLIC_CF_WORKER_URL    ?? "",
    },
  },
};