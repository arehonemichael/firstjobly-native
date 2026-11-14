import { useScreenBottomPadding } from "../hooks/use-screen-bottom-padding";
import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, Switch, View } from "react-native";
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
import { reauthenticateGoogle } from "../lib/account/google-reauth";
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
          key={auth.user.id}
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
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false),
    [stopReminders, setStopReminders] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [code, setCode] = useState(""),
    [passwordHint, setPasswordHint] = useState(false);
  const lock = useRef(false),
    alive = useRef(true);
  const proof = useRef<Awaited<ReturnType<typeof reauthenticateGoogle>> | null>(
    null,
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const value = proof.current;
      proof.current = null;
      void value?.dispose();
    };
  }, []);
  const providers = [
    ...(user.identities?.map((identity) => identity.provider) ?? []),
    ...(Array.isArray(user.app_metadata.providers)
      ? user.app_metadata.providers.filter(
          (value: unknown): value is string => typeof value === "string",
        )
      : []),
  ];
  const google =
    providers.includes("google") || user.app_metadata.provider === "google";
  const passwordAllowed =
    passwordHint || !google || providers.includes("email");
  async function verifyGoogle() {
    if (lock.current || !user.email) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await reauthenticateGoogle(user.id, user.email);
      if (!alive.current) {
        await value.dispose();
        return;
      }
      await proof.current?.dispose();
      proof.current = value;
      setPassword("");
      setNotice(
        "Google verified. Review the consequences, type your email and tap Permanently delete my account.",
      );
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Google verification failed.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function remove() {
    if (
      lock.current ||
      !confirmed ||
      !user.email ||
      email.trim().toLowerCase() !== user.email.trim().toLowerCase()
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await accountDeletion.delete(
        user.id,
        email,
        password || undefined,
        proof.current ?? undefined,
      );
      onDeleted(user.id, stopReminders);
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error ? e.message : "Deletion could not be confirmed.",
        );
        if (e instanceof AccountDeletionError) {
          setCode(e.code);
          setPasswordHint(e.methods.includes("password"));
          if (e.retryAt)
            setNotice(
              `Try again after ${new Date(e.retryAt).toLocaleTimeString("en-ZA", { hour12: false })}.`,
            );
        }
      }
    } finally {
      if (alive.current) setPassword("");
      lock.current = false;
      if (alive.current) setBusy(false);
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
      {
        <>
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
          {passwordAllowed && (
            <>
              <Text>
                Password (required unless you signed in within the last 10
                minutes)
              </Text>
              <TextInput
                accessibilityLabel="Confirm account password"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                style={cs.input}
              />
            </>
          )}
          {google && (
            <Button
              label="Verify with Google again"
              secondary
              disabled={busy || Platform.OS === "web"}
              onPress={() => void verifyGoogle()}
            />
          )}
          <View style={[cs.row, { flexWrap: "nowrap" }]}>
            <Switch
              accessibilityLabel="I understand deletion is permanent"
              value={confirmed}
              onValueChange={setConfirmed}
              disabled={busy}
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
              disabled={busy}
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
            <Text style={{ flex: 1 }}>
              Also turn off this phone’s weekly reminders.
            </Text>
          </View>
          <Button
            label={busy ? "Please wait…" : "Permanently delete my account"}
            disabled={
              busy ||
              !confirmed ||
              !user.email ||
              email.trim().toLowerCase() !== user.email.trim().toLowerCase()
            }
            onPress={() => void remove()}
          />
          {["auth_required", "reauth_required", "reauth_failed"].includes(
            code,
          ) && (
            <Button
              label="Sign in again"
              secondary
              disabled={busy}
              onPress={() =>
                router.push({
                  pathname: "/auth",
                  params: { returnTo: "/account-delete" },
                })
              }
            />
          )}
        </>
      }
      {(!user.email ||
        ["staff_protected", "manual_deletion_required"].includes(code)) && (
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
