const {
  IOS_SAMPLE_APP_ID,
  configureIosAds,
} = require("./scripts/ios-build-config.cjs");

/** Native app IDs belong in build configuration; unit IDs are platform-specific. */
module.exports = ({ config }) =>
  configureIosAds(config, process.env, IOS_SAMPLE_APP_ID);
