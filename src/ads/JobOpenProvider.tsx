import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";

import { useJobInterstitialManager } from "./useJobInterstitial";

type JobOpenContextValue = { openJob: (jobId: string) => Promise<void> };
const JobOpenContext = createContext<JobOpenContextValue | null>(null);
const originalPush = router.push.bind(router);

function jobIdFromHref(href: any): string | null {
  if (!href || typeof href === "string" || href.pathname !== "/jobs/[id]") return null;
  const id = href.params?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function JobOpenProvider({ children }: { children: ReactNode }) {
  const { openJob: openWithInterstitial } = useJobInterstitialManager();

  const openJob = useCallback(
    (jobId: string) => openWithInterstitial(jobId, () => originalPush({ pathname: "/jobs/[id]", params: { id: jobId } })),
    [openWithInterstitial],
  );

  useEffect(() => {
    const push = router.push.bind(router);
    const navigate = router.navigate.bind(router);
    const replace = router.replace.bind(router);

    (router as any).push = (...args: any[]) => {
      const jobId = jobIdFromHref(args[0]);
      if (jobId) return void openWithInterstitial(jobId, () => (push as any)(...args));
      return (push as any)(...args);
    };
    (router as any).navigate = (...args: any[]) => {
      const jobId = jobIdFromHref(args[0]);
      if (jobId) return void openWithInterstitial(jobId, () => (navigate as any)(...args));
      return (navigate as any)(...args);
    };
    (router as any).replace = (...args: any[]) => {
      const jobId = jobIdFromHref(args[0]);
      if (jobId) return void openWithInterstitial(jobId, () => (replace as any)(...args));
      return (replace as any)(...args);
    };

    return () => {
      (router as any).push = push;
      (router as any).navigate = navigate;
      (router as any).replace = replace;
    };
  }, [openWithInterstitial]);

  return <JobOpenContext.Provider value={{ openJob }}>{children}</JobOpenContext.Provider>;
}

export function useJobOpen() {
  const context = useContext(JobOpenContext);
  if (!context) throw new Error("useJobOpen must be used within JobOpenProvider");
  return context;
}
