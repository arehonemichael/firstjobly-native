export const extraTransitionPending = () => false;
export function offerExtraHomeTransition(
  _source: string,
  _proceed: () => void,
) {
  return false;
}
export function ExtraInterstitialLifecycle(_props: {
  ready: boolean;
  userId: string | null;
}) {
  return null;
}
