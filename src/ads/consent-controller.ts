export type ConsentInfo = {
  status: string;
  canRequestAds: boolean;
  privacyOptionsRequirementStatus?: string;
};
export type ConsentPort = {
  requestInfoUpdate(): Promise<ConsentInfo>;
  getConsentInfo?(): Promise<ConsentInfo>;
  showFormIfRequired(): Promise<ConsentInfo>;
  showPrivacyOptions(): Promise<ConsentInfo>;
  choices(): Promise<{
    storeAndAccessInformationOnDevice: boolean;
    selectBasicAds: boolean;
    selectPersonalisedAds?: boolean;
  }>;
  initialize(): Promise<unknown>;
};
export function createAdConsent(port: ConsentPort | null) {
  let state = {
    supported: !!port,
    settled: !port,
    canRequestAds: false,
    privacyRequired: false,
    failed: false,
    presenting: false,
    lastUiAt: 0,
    failedAt: null as number | null,
    personalized: false,
    errorMessage: null as string | null,
  };
  let pending: Promise<void> | null = null,
    initialized: Promise<unknown> | null = null,
    checked = false,
    opening = false;
  const listeners = new Set<() => void>();
  const publish = (next: typeof state) => {
    state = Object.freeze(next);
    listeners.forEach((f) => f());
  };
  async function modal<T>(action: () => Promise<T>): Promise<T> {
    publish({ ...state, presenting: true, lastUiAt: Date.now() });
    try {
      return await action();
    } finally {
      publish({ ...state, presenting: false, lastUiAt: Date.now() });
    }
  }
  async function apply(info: ConsentInfo) {
    const privacyRequired = info.privacyOptionsRequirementStatus === "REQUIRED";
    let allowed =
      info.canRequestAds &&
      (info.status === "NOT_REQUIRED" || info.status === "OBTAINED");
    let personalized = info.status === "NOT_REQUIRED";
    if (allowed && info.status === "OBTAINED") {
      const c = await port!.choices();
      personalized = c.selectPersonalisedAds === true;
      allowed =
        c.storeAndAccessInformationOnDevice === true &&
        c.selectBasicAds === true;
    }
    if (allowed) {
      initialized ??= port!.initialize().catch((error) => {
        initialized = null;
        throw error;
      });
      await initialized;
    }
    checked = true;
    publish({
      ...state,
      settled: true,
      canRequestAds: allowed,
      privacyRequired,
      failed: false,
      failedAt: null,
      personalized: allowed && personalized,
      errorMessage: null,
    });
  }
  function prepare(canPresent: () => boolean) {
    if (!port || checked) return Promise.resolve();
    if (pending) return pending;
    pending = (async () => {
      try {
        let info: ConsentInfo;
        try {
          info = await port.requestInfoUpdate();
        } catch (error) {
          // UMP may retain valid permission from the previous session even
          // when its update fails. Never infer permission from the error text.
          const cached = await port.getConsentInfo?.();
          if (
            !cached?.canRequestAds ||
            (cached.status !== "NOT_REQUIRED" && cached.status !== "OBTAINED")
          )
            throw error;
          await apply(cached);
          // Still mark the failed update so a later foreground can retry.
          // Use NPA conservatively until an update succeeds.
          publish({
            ...state,
            failed: true,
            failedAt: Date.now(),
            personalized: false,
            errorMessage:
              error instanceof Error
                ? error.message
                : "Consent information could not be updated.",
          });
          return;
        }
        if (info.status === "REQUIRED" || info.status === "UNKNOWN") {
          if (!canPresent()) return;
          info = await modal(() => port.showFormIfRequired());
        }
        await apply(info);
      } catch (error) {
        checked = true;
        publish({
          ...state,
          settled: true,
          canRequestAds: false,
          failed: true,
          failedAt: Date.now(),
          personalized: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Consent information is unavailable.",
        });
      } finally {
        pending = null;
      }
    })();
    return pending;
  }
  return {
    getSnapshot: () => state,
    subscribe(f: () => void) {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },
    prepare,
    retryOnForeground(canPresent: () => boolean) {
      if (
        state.presenting ||
        pending ||
        opening ||
        !state.failed ||
        state.failedAt === null ||
        Date.now() - state.failedAt < 30000
      )
        return Promise.resolve();
      checked = false;
      return prepare(canPresent);
    },
    getRequestOptions() {
      return {
        requestNonPersonalizedAdsOnly: !(
          state.canRequestAds && state.personalized
        ),
      };
    },
    async openPrivacy(canPresent: () => boolean) {
      if (!port || pending || opening || !canPresent()) return;
      opening = true;
      publish({ ...state, canRequestAds: false, personalized: false });
      try {
        if (state.privacyRequired)
          await apply(await modal(() => port.showPrivacyOptions()));
        else {
          checked = false;
          await prepare(canPresent);
        }
      } catch (error) {
        publish({
          ...state,
          settled: true,
          canRequestAds: false,
          failed: true,
          failedAt: Date.now(),
          personalized: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Privacy choices could not be updated.",
        });
      } finally {
        opening = false;
      }
    },
  };
}
