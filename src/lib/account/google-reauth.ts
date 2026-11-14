import { createClient } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "../supabase";
/** Isolated PKCE client: verification must not replace the app's current
 * account. Its fresh token is used only for the explicit deletion request. */
async function performGoogleVerification(owner: string, email: string) {
  if (Platform.OS === "web")
    throw Error("Use the installed app for Google verification.");
  const values = new Map<string, string>();
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "firstjobly-delete-reauth",
        storage: {
          getItem: (key) => values.get(key) ?? null,
          setItem: (key, value) => {
            values.set(key, value);
          },
          removeItem: (key) => {
            values.delete(key);
          },
        },
      },
    },
  );
  const dispose = async () => {
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    values.clear();
  };
  try {
    const Crypto = await import("expo-crypto").catch(() => {
      throw Error(
        "Install the updated native app to enable secure Google verification.",
      );
    });
    const redirect = "firstjobly://account-delete-callback";
    const start = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirect,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account", login_hint: email },
      },
    });
    if (start.error || !start.data.url)
      throw Error("Google verification could not start. Please try again.");
    // Native SHA-256 + CSPRNG avoid auth-js's plain/Math.random fallback
    // on React Native runtimes without the browser WebCrypto globals.
    const verifier = Array.from(await Crypto.getRandomBytesAsync(32), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const challenge = (
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      )
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const authorize = new URL(start.data.url);
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "s256");
    const result = await WebBrowser.openAuthSessionAsync(
      authorize.toString(),
      redirect,
    );
    if (result.type !== "success")
      throw Error(
        "Google verification was cancelled. Your account has not been deleted.",
      );
    const url = new URL(result.url);
    if (
      url.protocol !== "firstjobly:" ||
      url.hostname !== "account-delete-callback" ||
      (url.pathname && url.pathname !== "/") ||
      !url.searchParams.get("code")
    )
      throw Error(
        "Google verification did not return a valid code. Check the app redirect configuration.",
      );
    // The auth service's public PKCE token exchange (same wire contract as
    // auth-js exchangeCodeForSession); verifier stays in this function only.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 30000);
    let tokens: { access_token?: string; refresh_token?: string };
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=pkce`,
        {
          method: "POST",
          headers: {
            apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth_code: url.searchParams.get("code"),
            code_verifier: verifier,
          }),
          redirect: "error",
          signal: abort.signal,
        },
      );
      if (!response.ok)
        throw Error(
          "Google verification could not be completed. Please try again.",
        );
      tokens = await response.json();
      if (!tokens.access_token || !tokens.refresh_token)
        throw Error("Google verification returned no session.");
    } finally {
      clearTimeout(timer);
    }
    const exchange = await client.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    const current = await supabase.auth.getSession();
    if (
      exchange.error ||
      !exchange.data.session ||
      exchange.data.session.user.id !== owner ||
      current.data.session?.user.id !== owner
    )
      throw Error(
        "Choose the same Google account that is signed in to FirstJobly. No account was deleted.",
      );
    return {
      userId: owner,
      accessToken: exchange.data.session.access_token,
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}

let pendingVerification: ReturnType<typeof performGoogleVerification> | null =
  null;
export const activeGoogleVerification = () => pendingVerification;
export function reauthenticateGoogle(owner: string, email: string) {
  const task = performGoogleVerification(owner, email).then((value) => ({
    ...value,
    dispose: async () => {
      if (pendingVerification === task) pendingVerification = null;
      await value.dispose();
    },
  }));
  pendingVerification = task;
  return task;
}
