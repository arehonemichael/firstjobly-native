export const APP_STORE_URL = "https://apps.apple.com/app/id6834798190";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.first.firstjobly";
export const reviewLink = (store: "ios" | "android") =>
  store === "ios"
    ? APP_STORE_URL + "?action=write-review"
    : PLAY_STORE_URL + "&showAllReviews=true";
