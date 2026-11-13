export type ConsentInfo = {
  status: string;
  canRequestAds: boolean;
  privacyOptionsRequirementStatus?: string;
};
export type ConsentPort = {
  requestInfoUpdate(): Promise<ConsentInfo>;
  showFormIfRequired(): Promise<ConsentInfo>;
  showPrivacyOptions(): Promise<ConsentInfo>;
  choices(): Promise<{
    storeAndAccessInformationOnDevice: boolean;
    selectBasicAds: boolean;
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
    if (allowed && info.status === "OBTAINED") {
      const c = await port!.choices();
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
    });
  }
  function prepare(canPresent: () => boolean) {
    if (!port || checked) return Promise.resolve();
    if (pending) return pending;
    pending = (async () => {
      try {
        let info = await port.requestInfoUpdate();
        if (info.status === "REQUIRED" || info.status === "UNKNOWN") {
          if (!canPresent()) return;
          info = await modal(() => port.showFormIfRequired());
        }
        await apply(info);
      } catch {
        checked = true;
        publish({
          ...state,
          settled: true,
          canRequestAds: false,
          failed: true,
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
    async openPrivacy(canPresent: () => boolean) {
      if (!port || pending || opening || !canPresent()) return;
      opening = true;
      publish({ ...state, canRequestAds: false });
      try {
        if (state.privacyRequired)
          await apply(await modal(() => port.showPrivacyOptions()));
        else {
          checked = false;
          await prepare(canPresent);
        }
      } catch {
        publish({
          ...state,
          settled: true,
          canRequestAds: false,
          failed: true,
        });
      } finally {
        opening = false;
      }
    },
  };
}
