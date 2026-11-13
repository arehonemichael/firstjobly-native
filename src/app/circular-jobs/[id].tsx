import { useEffect, useRef, useState } from "react";
import { ScrollView, View, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  CheckSquare,
  Square,
  Copy,
  Phone,
  Mail,
  ChevronDown,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppText as Text,
  AppPressable as Pressable,
} from "../../components/ui/primitives";
import {
  Button,
  ErrorState,
  PageShell,
  SignIn,
  Skeleton,
  cs,
} from "../../components/circular/shared";
import { useCircularQuery, useCircularSave } from "../../hooks/use-circular";
import { circularAPI, rememberWithdrawn } from "../../lib/circular/client";
import type { Detail } from "../../lib/circular/contract";
import {
  saDate,
  salary,
  titleCase,
  profileLabels,
} from "../../lib/circular/contract";
import { copy, openURL } from "../../lib/circular/io";
import { CircularError } from "../../lib/circular/transport";
import { Colors } from "../../constants/theme";
export default function CircularDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCircularQuery<Detail>(
    id ? "/circular-jobs/" + encodeURIComponent(id) : null,
  );
  const saver = useCircularSave();
  const [duties, setDuties] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<Error>();
  const [notice, setNotice] = useState("");
  const withdrawn = useRef<string | null>(null);
  const { bottom } = useSafeAreaInsets();
  useEffect(() => {
    if (
      query.error instanceof CircularError &&
      query.error.status === 404 &&
      query.userId &&
      withdrawn.current !== id
    ) {
      withdrawn.current = id;
      rememberWithdrawn(query.userId, id);
      void circularAPI
        .request(
          query.userId,
          "/circular-jobs/" + encodeURIComponent(id) + "/save",
          "DELETE",
        )
        .catch(() => {});
    }
  }, [query.error, query.userId, id]);
  if (query.loading && !query.data)
    return (
      <PageShell back title="Government job">
        <Skeleton />
      </PageShell>
    );
  if (!query.userId)
    return (
      <PageShell back title="Government job">
        <SignIn returnTo={"/circular-jobs/" + id} />
      </PageShell>
    );
  if (query.error)
    return (
      <PageShell back title="Government job">
        <View style={cs.content}>
          {query.error instanceof CircularError &&
          query.error.status === 404 ? (
            <View style={cs.card}>
              <Text style={cs.heading}>This job was withdrawn</Text>
              <Text style={cs.muted}>
                It has been removed from your saved government jobs.
              </Text>
              <Button
                label="Browse government jobs"
                onPress={() => router.replace("/circular-jobs")}
              />
            </View>
          ) : (
            <ErrorState error={query.error} retry={query.refresh} />
          )}
        </View>
      </PageShell>
    );
  const detail = query.data;
  if (!detail)
    return (
      <PageShell back>
        <Skeleton />
      </PageShell>
    );
  const { job, requirements_match: match } = detail;
  const statusColor = {
    meets: Colors.success,
    check: Colors.warning,
    unmet: Colors.error,
  };
  const statusLabel = {
    meets: "Meets requirements",
    check: "Check requirements",
    unmet: "Requirements not met",
  };
  async function copyValue(value: string) {
    try {
      await copy(value);
      setNotice("Copied");
    } catch {
      setError(
        Error("Could not copy. You can select and copy the text instead."),
      );
    }
  }
  return (
    <PageShell back>
      <ScrollView contentContainerStyle={cs.content}>
        <Text style={cs.title}>{titleCase(job.post_title)}</Text>
        <Text style={cs.heading}>{job.department}</Text>
        <Text style={cs.muted}>
          {[job.centre, job.province].filter(Boolean).join(" · ") ||
            "Location not stated"}
        </Text>
        <Text style={cs.heading}>{salary(job.salary_text)}</Text>
        <Text
          style={[
            cs.body,
            job.closes_in_days !== null &&
              job.closes_in_days <= 2 &&
              job.closes_in_days >= 0 && { color: Colors.primary },
          ]}
        >
          {job.is_expired ? "Closed" : "Closes " + saDate(job.closing_date)}
          {job.closing_date_text ? " · " + job.closing_date_text : ""}
        </Text>
        {!!detail.application?.sent_at && <Text style={cs.muted}>Applied</Text>}
        <View style={cs.card}>
          {job.reference_number ? (
            <>
              <Text selectable style={cs.body}>
                Reference: {job.reference_number}
              </Text>
              <Pressable
                style={cs.row}
                accessibilityLabel="Copy reference number"
                onPress={() => void copyValue(job.reference_number!)}
              >
                <Copy size={18} color={Colors.muted} />
                <Text style={cs.link}>Copy reference</Text>
              </Pressable>
            </>
          ) : (
            <Text style={cs.body}>
              Quote the post title and centre when you apply.
            </Text>
          )}
        </View>
        <View style={cs.card}>
          <Text style={cs.heading}>Do I qualify?</Text>
          <Text style={[cs.body, { color: statusColor[match.overall] }]}>
            {statusLabel[match.overall]}
          </Text>
          {match.items.map((item, i) => (
            <View key={i} style={{ gap: 4 }}>
              <Text style={[cs.body, { color: statusColor[item.status] }]}>
                {profileLabels[item.criterion] ||
                  titleCase(item.criterion.replace(/_/g, " "))}{" "}
                · {statusLabel[item.status]}
              </Text>
              <Text style={cs.muted}>{item.detail}</Text>
            </View>
          ))}
          {detail.missing_profile_fields.map((field) =>
            field === "drivers_licence" ? (
              <Text key={field} style={cs.muted}>
                Check your driver’s licence against the advert when you apply.
              </Text>
            ) : (
              <Button
                key={field}
                label={"Add to profile: " + (profileLabels[field] || field)}
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/profile",
                    params: { section: field },
                  })
                }
              />
            ),
          )}
        </View>
        <View style={cs.card}>
          <Text style={cs.heading}>Requirements</Text>
          {Array.from(new Set(job.requirements.map((item) => item.kind))).map(
            (kind) => (
              <View key={kind} style={{ gap: 6 }}>
                <Text style={cs.body}>{titleCase(kind)}</Text>
                {job.requirements
                  .filter((item) => item.kind === kind)
                  .map((item, i) => (
                    <Text key={i} style={cs.muted}>
                      • {item.text}
                    </Text>
                  ))}
              </View>
            ),
          )}
        </View>
        <View style={cs.card}>
          <Pressable
            accessibilityState={{ expanded: duties }}
            onPress={() => setDuties((v) => !v)}
            style={cs.row}
          >
            <Text style={[cs.heading, { flex: 1 }]}>Duties</Text>
            <ChevronDown size={20} color={Colors.muted} />
          </Pressable>
          {duties &&
            job.duties.map((text, i) => (
              <Text style={cs.body} key={i}>
                • {text}
              </Text>
            ))}
        </View>
        <View style={cs.card}>
          <Text style={cs.heading}>Documents required</Text>
          {job.documents_required.map((document, i) => (
            <Pressable
              key={i}
              accessibilityRole="checkbox"
              aria-checked={checked.includes(document)}
              accessibilityState={{ checked: checked.includes(document) }}
              onPress={() =>
                setChecked((items) =>
                  items.includes(document)
                    ? items.filter((x) => x !== document)
                    : [...items, document],
                )
              }
              style={[cs.row, { flexWrap: "nowrap" }]}
            >
              {checked.includes(document) ? (
                <CheckSquare size={20} color={Colors.muted} />
              ) : (
                <Square size={20} color={Colors.muted} />
              )}
              <Text style={[cs.body, { flex: 1 }]}>{document}</Text>
            </Pressable>
          ))}
        </View>
        {!!job.notes && (
          <View style={cs.card}>
            <Text style={cs.heading}>Important notes</Text>
            <Text style={cs.body}>{job.notes}</Text>
          </View>
        )}
        <View style={cs.card}>
          <Text style={cs.heading}>Enquiries</Text>
          {!!job.enquiries?.name && (
            <Text style={cs.body}>{job.enquiries.name}</Text>
          )}
          {!!job.enquiries?.phone && (
            <Pressable
              style={cs.row}
              accessibilityLabel="Call enquiries"
              onPress={() => {
                const phone = job.enquiries.phone
                  ?.split(/\s+or\s+|\//i)[0]
                  .replace(/[^+\d]/g, "");
                if (phone)
                  void Linking.openURL("tel:" + phone).catch(() =>
                    setError(Error("No phone app is available.")),
                  );
              }}
            >
              <Phone size={18} color={Colors.muted} />
              <Text selectable style={[cs.link, { flex: 1 }]}>
                {job.enquiries.phone}
              </Text>
            </Pressable>
          )}
          {!!job.enquiries?.email && (
            <Pressable
              style={cs.row}
              accessibilityLabel="Email enquiries"
              onPress={() =>
                void Linking.openURL(
                  "mailto:" + encodeURIComponent(job.enquiries.email!),
                ).catch(() => setError(Error("No mail app is available.")))
              }
            >
              <Mail size={18} color={Colors.muted} />
              <Text selectable style={cs.link}>
                {job.enquiries.email}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={cs.card}>
          <Text style={cs.heading}>From the official circular</Text>
          <Text style={cs.muted}>
            {job.source.circular_title} · {saDate(job.source.issue_date)}
            {job.source.page ? " · page " + job.source.page : ""}
          </Text>
          {job.source.official_pdf_url && (
            <Button
              label="View on DPSA"
              secondary
              onPress={() =>
                void openURL(job.source.official_pdf_url).catch(setError)
              }
            />
          )}
        </View>
        {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
        {error && (
          <ErrorState error={error} retry={() => setError(undefined)} />
        )}
      </ScrollView>
      <View style={[cs.bottom, { paddingBottom: Math.max(16, bottom) }]}>
        <View style={{ flex: 1 }}>
          <Button
            label={detail.saved ? "Saved" : "Save"}
            secondary
            disabled={saver.busy === id}
            onPress={() =>
              void saver.save({ ...job, saved: detail.saved }).catch(setError)
            }
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={job.is_expired ? "Applications closed" : "Apply"}
            disabled={job.is_expired}
            onPress={() =>
              router.push({
                pathname: "/circular-jobs/apply",
                params: { jobId: id },
              })
            }
          />
        </View>
      </View>
    </PageShell>
  );
}
