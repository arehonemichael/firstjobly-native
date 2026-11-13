import { useState } from "react";
import { View } from "react-native";
import { Landmark, ArrowRight } from "lucide-react-native";
import { router } from "expo-router";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import { Colors } from "../../constants/theme";
import { useLatestCircular } from "../../hooks/use-circular";
import { circularAPI } from "../../lib/circular/client";
import type { Batch } from "../../lib/circular/contract";
import { saDate } from "../../lib/circular/contract";
import { downloadBatch, openURL } from "../../lib/circular/io";
import { Button, ErrorState, cs } from "./shared";
export function LatestCircularCard({ compact = false }: { compact?: boolean }) {
  const query = useLatestCircular();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const batch = query.data?.batch;
  async function download() {
    if (!query.userId || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const fresh = await circularAPI.request<{ batch: Batch | null }>(
        query.userId,
        "/circular-batches/latest",
      );
      if (!fresh.batch) throw Error("No circular is available yet.");
      await downloadBatch(fresh.batch);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  if (compact)
    return (
      <Pressable
        accessibilityLabel="Government jobs"
        onPress={() => router.push("/circular-jobs")}
        style={cs.card}
      >
        <View style={cs.row}>
          <Landmark size={23} color={Colors.muted} />
          <Text style={[cs.heading, { flex: 1 }]}>Government jobs</Text>
          <ArrowRight size={20} color={Colors.muted} />
        </View>
        <Text style={cs.muted}>
          {batch
            ? `Circular ${batch.circular_number} · ${batch.job_count} entry-level jobs${batch.earliest_closing_date ? " · closes from " + saDate(batch.earliest_closing_date) : ""}`
            : "Browse entry-level jobs from official government circulars."}
        </Text>
      </Pressable>
    );
  if (query.loading && !batch)
    return (
      <View
        style={[cs.card, { height: 140 }]}
        accessibilityLabel="Loading latest circular"
      />
    );
  if (query.error)
    return <ErrorState error={query.error} retry={query.refresh} />;
  if (!batch)
    return (
      <View style={cs.card}>
        <Text style={cs.heading}>Your next government opportunity</Text>
        <Text style={cs.muted}>
          No circular is available yet. New circulars usually come out on
          Fridays.
        </Text>
      </View>
    );
  return (
    <View style={cs.card}>
      <Text style={cs.heading}>{batch.title}</Text>
      <Text style={cs.muted}>
        Issued {saDate(batch.issue_date)} · {batch.job_count} entry-level jobs
      </Text>
      <View style={cs.row}>
        <Button
          label={busy ? "Saving PDF…" : "Download PDF"}
          disabled={busy}
          onPress={() => void download()}
        />
        {batch.official_pdf_url && (
          <Button
            label="View on DPSA"
            secondary
            onPress={() => void openURL(batch.official_pdf_url).catch(setError)}
          />
        )}
      </View>
      {error && <ErrorState error={error} retry={() => void download()} />}
    </View>
  );
}
