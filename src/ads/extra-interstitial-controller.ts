/** Monotonic foreground clock. No timer, route, load or resume can call show. */
export function createExtraInterstitialController(
  now: () => number = () => performance.now(),
) {
  const gap = 300000;
  let active = false,
    last = now(),
    elapsed = 0,
    gapOrigin = 0;
  let actions = 0;
  let attempts = 0,
    shown = 0,
    busy = false;
  function tick() {
    const time = now();
    if (active) elapsed += Math.max(0, time - last);
    last = time;
  }
  return {
    setActive(value: boolean) {
      tick();
      active = value;
    },
    noteInteraction() {
      actions++;
    },
    fullscreenEnded() {
      actions = 0;
      tick();
      gapOrigin = elapsed;
    },
    offer(
      present: (done: () => void, opened: () => void) => boolean,
      proceed: () => void,
    ) {
      tick();
      // A pending offer owns navigation. Ignore rapid duplicate transitions.
      if (busy) return true;
      if (
        !active ||
        actions < 2 ||
        attempts >= 2 ||
        shown >= 2 ||
        elapsed - gapOrigin < gap
      )
        return false;
      busy = true;
      let completed = false,
        counted = false;
      // Reserve before SDK callbacks, including synchronous error/OPENED callbacks.
      attempts++;
      const accepted = present(
        () => {
          if (completed) return;
          completed = true;
          busy = false;
          proceed();
        },
        () => {
          if (completed || counted) return;
          counted = true;
          shown++;
          tick();
          gapOrigin = elapsed;
        },
      );
      if (!accepted) {
        attempts--;
        busy = false;
        return false;
      }
      actions = 0;
      tick();
      gapOrigin = elapsed; // Failed attempts also wait five active minutes.
      return true;
    },
    isBusy: () => busy,
    state() {
      tick();
      return { elapsed, attempts, shown, busy, active };
    },
  };
}
