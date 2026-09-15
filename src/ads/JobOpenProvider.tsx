import { router } from "expo-router";
import { createContext, useCallback, useContext, type ReactNode } from "react";

import { useJobInterstitial } from "./useJobInterstitial";

type JobOpenContextValue = { openJob: (jobId: string) => Promise<void> };
const JobOpenContext = createContext<JobOpenContextValue | null>(null);

export function JobOpenProvider({ children }: { children: ReactNode }) {
  const { openJob: openWithInterstitial } = useJobInterstitial();
  const openJob = useCallback(
    (jobId: string) => openWithInterstitial(jobId, () => router.push({ pathname: "/jobs/[id]", params: { id: jobId } })),
    [openWithInterstitial],
  );
  return <JobOpenContext.Provider value={{ openJob }}>{children}</JobOpenContext.Provider>;
}

export function useJobOpen() {
  const context = useContext(JobOpenContext);
  if (!context) throw new Error("useJobOpen must be used within JobOpenProvider");
  return context;
}
