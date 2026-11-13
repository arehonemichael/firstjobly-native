import { useCallback } from "react";
/** Web downloads retain their normal no-native-ad behaviour. */
export function useRewardedDownload() {
  return {
    canOfferAd: false,
    beforeDownload: useCallback(async () => true, []),
    completeDownload: useCallback(() => {}, []),
  };
}
