import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";

import { useJobInterstitialManager } from "./useJobInterstitial";

type JobOpenContextValue = { openJob: (jobId: string) => Promise<void> };
const JobOpenContext = createContext<JobOpenContextValue | null>(null);

type RouterHref = Parameters<typeof router.push>[0];
type RouterOptions = Parameters<typeof router.push>[1];

function jobIdFromHref(href: RouterHref): string | null {
  if (!href || typeof href === "string") return null;
  if (href.pathname !== "/jobs/[id]") return null;
  const id = href.params && "id" in href.params ? href.params.id : null;
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

    (router as any).push = (href: RouterHref, options?: RouterOptions) => {
      const jobId = jobIdFromHref(href);
      if (jobId) return void openWithInterstitial(jobId, () => push(href, options));
      return push(href, options);
    };
    (router as any).navigate = (href: RouterHref, options?: RouterOptions) => {
      const jobId = jobIdFromHref(href);
      if (jobId) return void openWithInterstitial(jobId, () => navigate(href, options));
      return navigate(href, options);
    };
    (router as any).replace = (href: RouterHref, options?: RouterOptions) => {
      const jobId = jobIdFromHref(href);
      if (jobId) return void openWithInterstitial(jobId, () => replace(href, options));
      return replace(href, options);
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

const originalPush = router.push.bind(router);
