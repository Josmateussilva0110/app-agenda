const { withAndroidStyles, AndroidConfig } = require("@expo/config-plugins");

/**
 * expo-navigation-bar's setBackgroundColorAsync/setButtonStyleAsync only take
 * effect when Android isn't drawing its own protective scrim over the bar.
 * That scrim comes from android:enforceNavigationBarContrast, which RN's
 * default template sets to true — this plugin turns it off so our own
 * theme-matched color/icon style actually shows through.
 */
function withNavigationBarContrast(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(
      config.modResults,
      {
        add: true,
        parent: AndroidConfig.Styles.getAppThemeGroup(),
        name: "android:enforceNavigationBarContrast",
        value: "false",
      }
    );
    return config;
  });
}

module.exports = withNavigationBarContrast;
