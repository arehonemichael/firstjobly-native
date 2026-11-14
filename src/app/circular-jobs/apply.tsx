import { SavedApplicationDocuments } from "../../components/circular/saved-application-documents";
import { useAuth } from "../../hooks/use-auth";
import type { EmailPaths } from "../../lib/circular/email-contract";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState, ScrollView, View, Platform } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  AppText as Text,
  AppTextInput as TextInput,
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
import { useCircularQuery, circularChanged } from "../../hooks/use-circular";
import { applications, circularAPI } from "../../lib/circular/client";
import {
  methodLabels,
  titleCase,
  type Detail,
  type Method,
} from "../../lib/circular/contract";
import {
  chooseCV,
  chooseSupporting,
  emailPaths,
  openEmail,
  compose,
  copy,
  openURL,
  saveApplicationPDF,
} from "../../lib/circular/io";
export default function CircularApply() {
  const params = useLocalSearchParams<{
    jobId?: string;
    application?: string;
  }>();
  const { userId } = useAuth();
  return (
    <CircularApplyForm
      key={`${userId || "guest"}:${params.application || params.jobId || "none"}`}
    />
  );
}
function CircularApplyForm() {
  const params = useLocalSearchParams<{
    jobId?: string;
    application?: string;
  }>();
  const query = useCircularQuery<Detail>(
    params.jobId ? "/circular-jobs/" + encodeURIComponent(params.jobId) : null,
  );
  const session = useSyncExternalStore(
    applications.subscribe,
    () => applications.get(query.userId, params.application),
    () => undefined,
  );
  const detail = session?.detail || query.data;
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [savedPDF, setSavedPDF] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState(false);
  const [licence, setLicence] = useState(false);
  const [message, setMessage] = useState(() =>
    session
      ? `Please find my application documents attached for ${titleCase(session.detail.job.post_title)}. Thank you for your consideration.`
      : "Please find my application documents attached. Thank you for your consideration.",
  );
  const [manualEmail, setManualEmail] = useState(false);
  const [paths, setPaths] = useState<EmailPaths>({
    composer: false,
    defaultApp: false,
    clients: [],
  });
  const [handoffNote, setHandoffNote] = useState("");
  useEffect(() => {
    let alive = true;
    void emailPaths()
      .then((value) => {
        if (alive) setPaths(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const locked = useRef(false);
  const handoff = useRef(false);
  const departing = useRef(false);
  useFocusEffect(
    useCallback(() => {
      departing.current = false;
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void emailPaths()
          .then(setPaths)
          .catch(() => {});
      if (state === "active" && handoff.current) {
        handoff.current = false;
        setConfirm(true);
      }
    });
    return () => subscription.remove();
  }, []);
  const key = session?.key;
  useEffect(
    () => () => {
      if (key && !departing.current) applications.remove(key);
    },
    [key],
  );
  // Explicitly retain only the temporary PDF files while the Z83 route is active.
  async function start() {
    if (!detail || !query.userId || !method || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await circularAPI.request(
        query.userId,
        "/circular-jobs/" + detail.job.id + "/apply-intent",
        "POST",
        { stage: "started", method },
      );
      const application = applications.create(query.userId, detail, method);
      circularChanged();
      router.replace({
        pathname: "/circular-jobs/apply",
        params: { application },
      });
    } catch (e) {
      setError(e as Error);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function perform() {
    if (!session || !session.z83 || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (session.method === "email") {
        if (!session.cv)
          throw Error(
            "Choose your CV PDF first so both documents can be attached.",
          );
        if (!session.detail.apply.emails[0])
          throw Error(
            "No email address is provided. Check the official circular.",
          );
        const result = await compose(
          session.detail.apply.emails[0],
          session.detail.apply.email_subject,
          session.z83,
          session.cv,
          message,
          (session.supporting ?? []).map((file) => file.uri),
          () => applications.get(query.userId, session.key) === session,
        );
        if (result === "manual") {
          setConfirm(false);
          setManualEmail(true);
          setHandoffNote(
            "Apple Mail’s composer is unavailable. Use the email options below; your documents and application details are still here.",
          );
        } else if (result === "cancelled") {
          setConfirm(false);
          setHandoffNote(
            "Email composer closed without sending. Your application has not been marked sent.",
          );
        } else {
          setConfirm(true);
          setHandoffNote(
            "Email handoff finished. FirstJobly cannot confirm sending or delivery.",
          );
        }
      } else if (session.method === "online") {
        handoff.current = true;
        await openURL(session.detail.apply.urls[0]);
        setConfirm(true);
      } else {
        setConfirm(true);
      }
    } catch (e) {
      handoff.current = false;
      setError(e as Error);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function openManualEmail(clientURL?: string) {
    if (!session || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      handoff.current = true;
      await openEmail(
        session.detail.apply.emails[0],
        session.detail.apply.email_subject,
        message,
        clientURL,
      );
      setHandoffNote(
        "Email app opened. Attach your saved documents and review all details before sending. Opening an app does not submit an application.",
      );
      setConfirm(true);
    } catch (e) {
      handoff.current = false;
      setError(e as Error);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function markSent() {
    if (!session || !query.userId || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await circularAPI.request(
        query.userId,
        "/circular-jobs/" + session.detail.job.id + "/apply-intent",
        "POST",
        { stage: "sent", method: session.method },
      );
      setSent(true);
      setConfirm(false);
      applications.remove(session.key);
      circularChanged();
    } catch (e) {
      setError(e as Error);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (sent)
    return (
      <PageShell back title="Application recorded">
        <View style={cs.content}>
          <Text style={cs.heading}>Applied</Text>
          <Text style={cs.body}>
            Your confirmation has been recorded. The department handles your
            application directly.
          </Text>
          <Button
            label="Browse government jobs"
            onPress={() => router.replace("/circular-jobs")}
          />
        </View>
      </PageShell>
    );
  if (query.authLoading || (params.jobId && query.loading && !detail))
    return (
      <PageShell back title="Prepare your application">
        <Skeleton />
      </PageShell>
    );
  if (!query.userId)
    return (
      <PageShell back title="Prepare your application">
        <SignIn
          returnTo={
            params.jobId ? "/circular-jobs/" + params.jobId : "/circular-jobs"
          }
        />
      </PageShell>
    );
  if (!detail)
    return (
      <PageShell back title="Prepare your application">
        <View style={cs.content}>
          {query.error ? (
            <ErrorState error={query.error} retry={query.refresh} />
          ) : (
            <>
              <Text style={cs.body}>
                This application session has ended. Open the job to start again.
              </Text>
              <Button
                label="Government jobs"
                onPress={() => router.replace("/circular-jobs")}
              />
            </>
          )}
        </View>
      </PageShell>
    );
  if (detail.job.is_expired)
    return (
      <PageShell back title="Applications closed">
        <View style={cs.content}>
          <Text style={cs.body}>
            The closing date for this post has passed.
          </Text>
          <Button
            label="Browse government jobs"
            onPress={() => router.replace("/circular-jobs")}
          />
        </View>
      </PageShell>
    );
  const chosen = session?.method || method;
  const address =
    chosen === "post"
      ? detail.apply.postal_address
      : detail.apply.hand_delivery_address;
  return (
    <PageShell back title="Prepare your application">
      <ScrollView contentContainerStyle={cs.content}>
        <Text style={cs.heading}>{titleCase(detail.job.post_title)}</Text>
        {!!detail.apply.instructions && (
          <Text style={cs.body}>{detail.apply.instructions}</Text>
        )}
        {!session ? (
          <>
            <Text style={cs.heading}>How will you apply?</Text>
            {detail.apply.methods.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="radio"
                aria-checked={method === item}
                accessibilityState={{ checked: method === item }}
                style={[cs.chip, method === item && cs.selected]}
                onPress={() => setMethod(item)}
              >
                <Text>{methodLabels[item]}</Text>
              </Pressable>
            ))}
            {!detail.apply.methods.length && (
              <Text>
                Check the official circular for application instructions.
              </Text>
            )}
            {detail.job.drivers_licence_required && (
              <Pressable
                accessibilityRole="checkbox"
                aria-checked={licence}
                accessibilityState={{ checked: licence }}
                style={cs.card}
                onPress={() => setLicence((v) => !v)}
              >
                <Text>
                  {licence ? "✓ " : ""}I have checked the driver’s licence
                  requirement.
                </Text>
                <Text style={cs.muted}>
                  This check stays on this screen and is not added to your
                  profile.
                </Text>
              </Pressable>
            )}
            <Button
              label={busy ? "Starting…" : "Continue to Z83 preparation"}
              disabled={
                busy ||
                !method ||
                (detail.job.drivers_licence_required && !licence)
              }
              onPress={() => void start()}
            />
          </>
        ) : (
          <>
            <View style={cs.card}>
              <Text style={cs.heading}>1. Prepare your Z83</Text>
              <Text style={cs.body}>
                Your post and profile details are pre-filled. Check them, then
                complete the remaining fields and Section B for this application
                only.
              </Text>
              <Text style={cs.muted}>
                Answers stay in memory unless you explicitly choose to remember
                reusable details securely. Job details and declarations are
                never remembered. Temporary PDFs are removed when you finish or
                leave this application.
              </Text>
              {detail.z83_requirements?.job_specific?.map((item) => (
                <Text key={item.field} style={cs.muted}>
                  {item.reason}
                </Text>
              ))}
              {session.z83 ? (
                <View style={{ gap: 12 }}>
                  <Text>Z83 PDF ready</Text>
                  <Button
                    label={
                      Platform.OS === "ios"
                        ? "Save Z83 to Files"
                        : savedPDF
                          ? "Z83 saved to Downloads"
                          : "Save Z83 to Downloads"
                    }
                    secondary
                    onPress={() =>
                      void saveApplicationPDF(session.z83!)
                        .then(() => {
                          if (Platform.OS !== "ios") setSavedPDF(true);
                          else
                            setHandoffNote(
                              "Export options closed. If you chose Save to Files, check Files for your copy; saving or cancellation cannot be confirmed.",
                            );
                        })
                        .catch(setError)
                    }
                  />
                </View>
              ) : (
                <Button
                  label="Complete Z83"
                  onPress={() => {
                    departing.current = true;
                    router.push({
                      pathname: "/z83",
                      params: { circularApplication: session.key },
                    });
                  }}
                />
              )}
            </View>
            <View style={cs.card}>
              <Text style={cs.heading}>2. Add your CV</Text>
              <Text style={cs.muted}>
                Use your current CV as a PDF. Need to update it? CV Maker is
                under More.
              </Text>
              <Button
                label="Open CV Maker"
                secondary
                onPress={() => {
                  departing.current = true;
                  router.push("/cv-maker");
                }}
              />
              {session.cvName && <Text>{session.cvName}</Text>}
              <Button
                label={session.cv ? "Change CV PDF" : "Choose CV PDF"}
                secondary
                onPress={() => {
                  setError(undefined);
                  void chooseCV()
                    .then((file) => {
                      if (file && query.userId) {
                        applications.setFile(
                          query.userId,
                          session.key,
                          "cv",
                          file.uri,
                          file.name,
                        );
                      }
                    })
                    .catch(setError);
                }}
              />
            </View>
            <View style={cs.card}>
              <Text style={cs.heading}>Supporting documents</Text>
              <Text style={cs.muted}>
                Add up to four supporting PDFs, 5 MB each, if the advert
                requires them.
              </Text>
              {(session.supporting ?? []).map((file, index) => (
                <View key={file.uri}>
                  <Text>{file.name}</Text>
                  <Button
                    label={`Remove supporting PDF ${index + 1}`}
                    secondary
                    onPress={() => {
                      if (query.userId)
                        applications.setSupporting(
                          query.userId,
                          session.key,
                          (session.supporting ?? []).filter(
                            (item) => item.uri !== file.uri,
                          ),
                        );
                    }}
                  />
                </View>
              ))}
              <Button
                label="Choose supporting PDFs"
                secondary
                disabled={busy}
                onPress={() =>
                  void chooseSupporting()
                    .then((files) => {
                      if (files && query.userId)
                        applications.setSupporting(
                          query.userId,
                          session.key,
                          files,
                        );
                    })
                    .catch(setError)
                }
              />
            </View>
            <SavedApplicationDocuments
              key={`${query.userId}:${session.key}`}
              owner={query.userId}
              application={session.key}
              onError={setError}
            />
            <View style={cs.card}>
              <Text style={cs.heading}>
                3. Apply by {methodLabels[session.method].toLowerCase()}
              </Text>
              {session.method === "email" && (
                <>
                  <Text selectable style={cs.body}>
                    {detail.apply.emails[0]}
                  </Text>
                  <Text selectable style={cs.muted}>
                    Subject: {detail.apply.email_subject}
                  </Text>
                  <Button
                    label="Copy email address"
                    secondary
                    onPress={() =>
                      void copy(detail.apply.emails[0]).catch(setError)
                    }
                  />
                  <Button
                    label="Copy subject"
                    secondary
                    onPress={() =>
                      void copy(detail.apply.email_subject).catch(setError)
                    }
                  />
                  <Text>Message</Text>
                  <TextInput
                    accessibilityLabel="Application email message"
                    multiline
                    value={message}
                    onChangeText={setMessage}
                    style={cs.input}
                  />
                  <Button
                    label="Copy message"
                    secondary
                    onPress={() => void copy(message).catch(setError)}
                  />
                  <Text style={cs.muted}>
                    Choose a compatible email app to receive your Z83, CV and
                    all selected supporting PDFs together, with the subject and
                    message. Some iOS apps require you to paste the recipient or
                    subject. Copy the address above and review every field
                    before sending.
                  </Text>
                  <Button
                    label="Other email apps / manual attachments"
                    secondary
                    onPress={() => setManualEmail((v) => !v)}
                  />
                  {manualEmail && (
                    <View style={{ gap: 12 }}>
                      <Text style={cs.muted}>
                        Save each document below using Save to Files on iOS. In
                        your email app, paste the copied recipient, subject and
                        message, then attach the files. Share options may offer
                        compatible apps, one document at a time; recipient and
                        subject are not prefilled there.
                      </Text>
                      {session.z83 && (
                        <Button
                          label={
                            Platform.OS === "ios"
                              ? "Save/share Z83 via Files"
                              : "Save Z83 PDF"
                          }
                          secondary
                          onPress={() =>
                            void saveApplicationPDF(
                              session.z83!,
                              "Z83.pdf",
                            ).catch(setError)
                          }
                        />
                      )}
                      {session.cv && (
                        <Button
                          label={
                            Platform.OS === "ios"
                              ? "Save CV to Files"
                              : "Save CV PDF"
                          }
                          secondary
                          onPress={() =>
                            void saveApplicationPDF(
                              session.cv!,
                              "CV.pdf",
                            ).catch(setError)
                          }
                        />
                      )}
                      {(session.supporting ?? []).map((file, index) => (
                        <Button
                          key={file.uri}
                          label={`Save supporting PDF ${index + 1}`}
                          secondary
                          onPress={() =>
                            void saveApplicationPDF(
                              file.uri,
                              `Supporting-document-${index + 1}.pdf`,
                            ).catch(setError)
                          }
                        />
                      ))}
                      {paths.defaultApp && (
                        <Button
                          label="Open default email app — attach files manually"
                          secondary
                          disabled={busy}
                          onPress={() => void openManualEmail()}
                        />
                      )}
                      {paths.clients.map((client) => (
                        <Button
                          key={client.url}
                          label={`Open ${client.label} — add details and files manually`}
                          secondary
                          disabled={busy}
                          onPress={() => void openManualEmail(client.url)}
                        />
                      ))}
                      {!paths.defaultApp && !paths.clients.length && (
                        <Text style={cs.muted}>
                          No email app could be opened from FirstJobly. Your
                          application details remain here. Copy them and save
                          the documents, then open an email app yourself.
                        </Text>
                      )}
                    </View>
                  )}
                </>
              )}
              {session.method === "online" && (
                <Text style={cs.muted}>
                  Save your Z83 using the document action above, then open the
                  employer’s site and upload your Z83 and CV there.
                </Text>
              )}
              {(session.method === "post" ||
                session.method === "hand_delivery") && (
                <>
                  <Text selectable style={cs.body}>
                    {address || "Check the official circular for the address."}
                  </Text>
                  {address && (
                    <Button
                      label="Copy address"
                      secondary
                      onPress={() => void copy(address).catch(setError)}
                    />
                  )}
                </>
              )}
              {session.method === "other" && (
                <Text style={cs.body}>
                  Follow the instructions in the official circular.
                </Text>
              )}
              <Button
                label={
                  busy
                    ? "Opening…"
                    : session.method === "email"
                      ? Platform.OS === "ios"
                        ? "Choose email app — attach all PDFs"
                        : "Open email with attachments"
                      : session.method === "online"
                        ? "Open application site"
                        : "I’ve finished applying"
                }
                disabled={
                  busy ||
                  !session.z83 ||
                  (session.method === "email" && !session.cv)
                }
                onPress={() => void perform()}
              />
              {Platform.OS === "web" && (
                <Text style={cs.muted}>
                  Use the installed iOS or Android app to generate and attach
                  documents.
                </Text>
              )}
            </View>
            {confirm && (
              <View accessibilityLiveRegion="polite" style={cs.card}>
                <Text style={cs.heading}>Did you send your application?</Text>
                <Text style={cs.muted}>
                  Opening another app does not submit your application.
                </Text>
                <Button
                  label="Yes, I sent it"
                  disabled={busy}
                  onPress={() => void markSent()}
                />
                <Button
                  label="Not yet"
                  secondary
                  onPress={() => setConfirm(false)}
                />
              </View>
            )}
            <Button
              label="Finish later"
              secondary
              onPress={() => {
                applications.remove(session.key);
                router.replace({
                  pathname: "/circular-jobs/[id]",
                  params: { id: detail.job.id },
                });
              }}
            />
          </>
        )}
        {!!handoffNote && (
          <Text accessibilityLiveRegion="polite">{handoffNote}</Text>
        )}
        {error && (
          <ErrorState error={error} retry={() => setError(undefined)} />
        )}
      </ScrollView>
    </PageShell>
  );
}
