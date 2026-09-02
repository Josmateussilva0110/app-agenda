const fs = require("fs");
const path = require("path");
const appJson = require("./app.json");
const packageJson = require("./package.json");

const versionFile = path.join(__dirname, "version.build.json");
const buildMeta = fs.existsSync(versionFile)
  ? JSON.parse(fs.readFileSync(versionFile, "utf8"))
  : { versionCode: 1 };

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const googleSignInIosUrlScheme = webClientId
  ? `com.googleusercontent.apps.${webClientId.replace(".apps.googleusercontent.com", "")}`
  : "com.googleusercontent.apps.placeholder";

const basePlugins = appJson.expo.plugins ?? [];

/** @type {import("@expo/config").ExpoConfig} */
module.exports = {
  ...appJson.expo,
  version: packageJson.version,
  plugins: [
    ...basePlugins,
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: googleSignInIosUrlScheme,
      },
    ],
  ],
  android: {
    ...appJson.expo.android,
    versionCode: buildMeta.versionCode,
  },
  extra: {
    ...appJson.expo.extra,
    appVersion: packageJson.version,
    versionCode: buildMeta.versionCode,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  },
};
