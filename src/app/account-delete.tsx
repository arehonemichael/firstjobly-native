import { useScreenBottomPadding } from "../hooks/use-screen-bottom-padding";
import { useEffect, useRef, useState } from "react";
import { AppState, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "../hooks/use-auth";
import {
  AppText as Text,
  AppTextInput as TextInput,
} from "../components/ui/primitives";
import {
  Button,
  PageShell,
  SignIn,
  Skeleton,
  cs,
} from "../components/circular/shared";
import { Colors } from "../constants/theme";
import { accountDeletion, finishAccountDeletion } from "../lib/account/client";
import { AccountDeletionError } from "../lib/account/deletion";
import { deletionSessionScope } from "../lib/account/session-scope";
export default function DeleteAccountScreen() {
  const auth = useAuth();
  const bottom = useScreenBottomPadding(false);
  const [completion, setCompletion] = useState<{
    owner: string;
    stop: boolean;
    done: boolean;
    error: string;
  } | null>(null);
  const running = useRef(false);
  async function cleanup(owner: string, stop: boolean) {
    if (running.current) return;
    running.current = true;
    setCompletion({ owner, stop, done: false, error: "" });
    try {
      const result = await finishAccountDeletion(owner, stop);
      setCompletion({
        owner,
        stop,
        done: true,
        error: result.sharedCleaned
          ? ""
          : "Account-owned file cleanup finished. Shared device drafts were left untouched because the original session was no longer present. Copies exported earlier may need manual removal.",
      });
    } catch {
      setCompletion({
        owner,
        stop,
        done: false,
        error:
          "Your account was deleted, but local cleanup could not finish. Retry cleanup; no new deletion request will be sent.",
      });
    } finally {
      running.current = false;
    }
  }
  const showCompletion =
    completion && (!auth.user || auth.user.id === completion.owner);
  return (
    <PageShell back title="Delete my account">
      {showCompletion ? (
        <ScrollView
          contentContainerStyle={[cs.content, { paddingBottom: bottom }]}
        >
          <Text accessibilityRole="header" style={cs.heading}>
            Account deletion confirmed
          </Text>
          <Text>
            Your account was permanently deleted.{" "}
            {completion.done
              ? "Account-owned cleanup has finished; see any notes below."
              : "Finishing local cleanup…"}
          </Text>
          {!!completion.error && (
            <>
              <Text accessibilityRole="alert">{completion.error}</Text>
              {!completion.done && (
                <Button
                  label="Retry local cleanup"
                  onPress={() =>
                    void cleanup(completion.owner, completion.stop)
                  }
                />
              )}
            </>
          )}
          <Button
            label="Back to Home"
            secondary
            onPress={() => router.replace("/")}
          />
        </ScrollView>
      ) : auth.loading ? (
        <Skeleton />
      ) : !auth.user ? (
        <SignIn returnTo="/account-delete" />
      ) : (
        <DeletionForm
          key={deletionSessionScope(
            auth.session?.access_token ?? "",
            auth.user.id,
            auth.user.email,
          )}
          user={auth.user}
          onDeleted={(owner, stop) => void cleanup(owner, stop)}
        />
      )}
    </PageShell>
  );
}
function DeletionForm({
  user,
  onDeleted,
}: {
  user: User;
  onDeleted(owner: string, stop: boolean): void;
}) {
  const bottom = useScreenBottomPadding(false);
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [stopReminders, setStopReminders] = useState(false);
  const [busy, setBusy] = useState<"send" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [sendAt, setSendAt] = useState(0);
  const [deleteAt, setDeleteAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const [requested, setRequested] = useState(false);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (Math.max(sendAt, deleteAt, expiresAt) <= Date.now()) return;
    const deadline = Math.max(sendAt, deleteAt, expiresAt);
    const update = () => {
      const value = Date.now();
      setClock(value);
      if (value >= deadline) clearInterval(timer);
    };
    const timer = setInterval(update, 1000);
    const state = AppState.addEventListener("change", (next) => {
      if (next === "active") update();
    });
    return () => {
      clearInterval(timer);
      state.remove();
    };
  }, [sendAt, deleteAt, expiresAt]);
  const sendWait = Math.max(0, Math.ceil((sendAt - clock) / 1000));
  const deleteWait = Math.max(0, Math.ceil((deleteAt - clock) / 1000));
  const matches =
    !!user.email &&
    email.trim().toLowerCase() === user.email.trim().toLowerCase();
  function failure(value: unknown, sending: boolean) {
    const e = value instanceof AccountDeletionError ? value : null;
    setError(
      value instanceof Error
        ? value.message
        : "Something went wrong. Please try again yourself.",
    );
    setErrorCode(e?.code ?? "");
    if (e?.retryAt) {
      if (sending || e.code === "code_locked")
        setSendAt((old) => Math.max(old, e.retryAt));
      if (!sending || e.code === "code_locked")
        setDeleteAt((old) => Math.max(old, e.retryAt));
    }
    if (e?.attemptsLeft !== undefined)
      setNotice(`${e.attemptsLeft} attempts left for this code.`);
    if (
      [
        "deletion_failed",
        "code_expired",
        "code_used",
        "code_missing",
        "code_session_mismatch",
        "code_email_changed",
      ].includes(e?.code ?? "")
    ) {
      setExpiresAt(0);
      setNotice(
        "Request a new confirmation code before trying again. Your account has not been confirmed deleted.",
      );
    }
    setClock(Date.now());
  }
  async function sendCode() {
    if (lock.current || !matches || sendAt > Date.now()) return;
    lock.current = true;
    setBusy("send");
    setError("");
    setNotice("");
    setErrorCode("");
    setEmailCode("");
    try {
      const result = await accountDeletion.sendCode(user.id);
      if (!alive.current) return;
      setRequested(true);
      setSendAt(result.retryAt);
      setExpiresAt(result.expiresAt);
      setClock(Date.now());
      setNotice(
        result.sent
          ? `Confirmation code sent to ${result.maskedEmail}. Enter it below. A new code replaces the previous one.`
          : `Check your inbox at ${result.maskedEmail}. Delivery is not confirmed, but the code stays valid if it arrives. Nothing will be resent automatically.`,
      );
    } catch (e) {
      if (alive.current) failure(e, true);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(null);
    }
  }
  async function remove() {
    if (
      lock.current ||
      !matches ||
      !confirmed ||
      !/^\d{6}$/.test(emailCode.trim()) ||
      deleteAt > Date.now()
    )
      return;
    lock.current = true;
    setBusy("delete");
    setError("");
    setNotice("");
    setErrorCode("");
    try {
      await accountDeletion.deleteWithEmailCode(user.id, email, emailCode);
      onDeleted(user.id, stopReminders);
    } catch (e) {
      if (alive.current) failure(e, false);
    } finally {
      lock.current = false;
      if (alive.current) {
        setEmailCode("");
        setBusy(null);
      }
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[cs.content, { paddingBottom: bottom }]}
    >
      <View style={cs.card}>
        <Text style={cs.heading}>Permanently delete your account</Text>
        <Text>
          This removes your account, profile, stored CVs/documents,
          applications, saved items and Community content. This cannot be
          undone.
        </Text>
        <Text style={cs.muted}>
          Some records remain: reports with their account link cleared
          (including anything typed in their details), anonymous
          Apply-click/device data, deletion and admin audit records containing
          your email/ID, and contact or employer messages. These retained
          records currently have no set deletion date.
        </Text>
        <Text style={cs.muted}>
          Copies exported to Downloads/Files and older untracked PDFs may need
          manual removal. Weekly phone reminders are a separate device
          preference.
        </Text>
      </View>
      <Text>Account: {user.email || "No email address"}</Text>
      {!user.email && (
        <Text accessibilityRole="alert">
          This account needs manual deletion support because it has no email
          address.
        </Text>
      )}
      <Text>Type your account email to confirm</Text>
      <TextInput
        accessibilityLabel="Confirm account email"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={cs.input}
      />
      <Text style={cs.muted}>
        We’ll email a six-digit code to this account. Enter it here to confirm
        deletion. You do not need to sign in to Google again.
      </Text>
      <Button
        label={
          busy === "send"
            ? "Sending code…"
            : sendWait
              ? `Send again in ${sendWait}s`
              : requested
                ? "Send again"
                : "Send confirmation code"
        }
        secondary
        disabled={!!busy || !matches || sendWait > 0}
        onPress={() => void sendCode()}
      />
      <Text>Confirmation code</Text>
      <TextInput
        accessibilityLabel="Email confirmation code"
        value={emailCode}
        onChangeText={setEmailCode}
        editable={!busy}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        style={cs.input}
      />
      <Text style={cs.muted}>
        Codes expire after 10 minutes and can be used once. Entering the code
        alone does not delete your account.
      </Text>
      {!!expiresAt && expiresAt <= clock && (
        <Text accessibilityLiveRegion="polite">
          This code may have expired. Request a new code if needed.
        </Text>
      )}
      <View style={[cs.row, { flexWrap: "nowrap" }]}>
        <Switch
          accessibilityLabel="I understand deletion is permanent"
          value={confirmed}
          onValueChange={setConfirmed}
          disabled={!!busy}
          trackColor={{ true: Colors.primary, false: Colors.border }}
        />
        <Text style={{ flex: 1 }}>
          I understand this permanently deletes my account.
        </Text>
      </View>
      <View style={[cs.row, { flexWrap: "nowrap" }]}>
        <Switch
          accessibilityLabel="Also turn off weekly device reminders"
          value={stopReminders}
          onValueChange={setStopReminders}
          disabled={!!busy}
          trackColor={{ true: Colors.primary, false: Colors.border }}
        />
        <Text style={{ flex: 1 }}>
          Also turn off this phone’s weekly reminders.
        </Text>
      </View>
      <Button
        label={
          busy === "delete" ? "Please wait…" : "Permanently delete my account"
        }
        disabled={
          !!busy ||
          !matches ||
          !confirmed ||
          !/^\d{6}$/.test(emailCode.trim()) ||
          deleteWait > 0
        }
        onPress={() => void remove()}
      />
      {deleteWait > 0 && (
        <Text accessibilityLiveRegion="polite">
          Try deletion again in {deleteWait}s.
        </Text>
      )}
      {["auth_required", "session_unsupported"].includes(errorCode) && (
        <>
          <Text style={cs.muted}>
            Your session needs a fresh sign-in. After signing in, request a new
            deletion code.
          </Text>
          <Button
            label="Sign in again"
            secondary
            disabled={!!busy}
            onPress={() =>
              router.push({
                pathname: "/auth",
                params: { returnTo: "/account-delete" },
              })
            }
          />
        </>
      )}
      {(!user.email ||
        [
          "staff_protected",
          "manual_deletion_required",
          "send_unavailable",
        ].includes(errorCode)) && (
        <Button
          label="Contact support"
          secondary
          onPress={() => router.push("/help")}
        />
      )}
      {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
    </ScrollView>
  );
}
