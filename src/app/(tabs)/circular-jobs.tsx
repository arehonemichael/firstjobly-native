import { CircularFeed } from "../../components/circular/feed";
import { PageShell } from "../../components/circular/shared";
import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useCircularBadge, circularChanged } from "../../hooks/use-circular";
export default function GovernmentJobs() {
  const { batch } = useLocalSearchParams<{ batch?: string }>();
  useEffect(() => {
    if (batch) circularChanged();
  }, [batch]);
  useCircularBadge(true);
  return (
    <PageShell title="Government jobs">
      <CircularFeed />
    </PageShell>
  );
}
