import { AccountDeletionError, type DeletionSession } from "./deletion";
import { deletionSessionScope } from "./session-scope";
export const DELETE_CODE_URL =
  "https://firstjobly.co.za/api/app/account/delete-code";
export type SentDeletionCode = {
  sent: boolean;
  maskedEmail: string;
  expiresAt: number;
  retryAt: number;
};
/** One explicit send, no automatic retries: a timeout may still deliver mail. */
export function createDeletionCodeSender(
  getSession: () => Promise<DeletionSession | null>,
  send: typeof fetch = fetch,
  now = Date.now,
  timeoutMs = 20000,
) {
  let busy = false;
  const blocked = new Map<string, number>();
  return {
    async send(owner: string): Promise<SentDeletionCode> {
      if (busy)
        throw new AccountDeletionError(
          "A code request is already running.",
          "busy",
        );
      const until = blocked.get(owner) ?? 0;
      if (until > now())
        throw new AccountDeletionError(
          "Please wait before sending another code.",
          "cooldown",
          429,
          [],
          until,
        );
      busy = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const session = await getSession();
        if (!session || session.user.id !== owner)
          throw new AccountDeletionError(
            "Your session changed. Sign in again before requesting a code.",
            "auth_required",
            401,
          );
        const scope = deletionSessionScope(
          session.access_token,
          owner,
          session.user.email,
        );
        const abort = new AbortController();
        timer = setTimeout(() => abort.abort(), timeoutMs);
        let response: Response, data: Record<string, unknown> | null;
        try {
          response = await send(DELETE_CODE_URL, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + session.access_token,
              "Content-Type": "application/json",
            },
            body: "{}",
            redirect: "error",
            cache: "no-store",
            signal: abort.signal,
          });
          data = await response.json();
        } catch {
          // Do not retry even on a network error: the server may have sent mail.
          const retryAt = now() + 60000;
          blocked.set(owner, retryAt);
          throw new AccountDeletionError(
            "We could not confirm the email was sent. Check your inbox; if a code arrives, you can enter it below. Wait before sending again.",
            "send_uncertain",
            0,
            [],
            retryAt,
          );
        }
        const current = await getSession();
        if (
          !current ||
          current.user.id !== owner ||
          deletionSessionScope(
            current.access_token,
            owner,
            current.user.email,
          ) !== scope
        )
          throw new AccountDeletionError(
            "Your sign-in changed. Request a new code for the account now shown.",
            "auth_required",
            401,
          );
        const value =
          data && typeof data === "object" && !Array.isArray(data) ? data : {};
        const seconds = Number(
          response.headers.get("Retry-After") ||
            value.retry_after_seconds ||
            value.retryAfterSeconds,
        );
        const retryAt =
          Number.isFinite(seconds) && seconds > 0
            ? now() + Math.ceil(seconds) * 1000
            : 0;
        if (retryAt) blocked.set(owner, retryAt);
        if (
          (response.status === 200 && value.sent === true) ||
          (response.status === 202 &&
            value.sent === false &&
            value.code === "send_uncertain")
        ) {
          const expiresAt =
            typeof value.expiresAt === "string"
              ? Date.parse(value.expiresAt)
              : NaN;
          if (
            typeof value.maskedEmail === "string" &&
            value.maskedEmail.length > 0 &&
            Number.isFinite(expiresAt) &&
            value.expiresInSeconds === 600 &&
            retryAt
          ) {
            return {
              sent: value.sent === true,
              maskedEmail: value.maskedEmail,
              expiresAt,
              retryAt,
            };
          }
        }
        if (response.ok) {
          const wait = retryAt || now() + 60000;
          blocked.set(owner, wait);
          throw new AccountDeletionError(
            "We could not confirm delivery. Check your inbox; a code that arrives can still be entered. Wait before sending again.",
            "send_uncertain",
            response.status,
            [],
            wait,
          );
        }
        throw new AccountDeletionError(
          typeof value.error === "string"
            ? value.error
            : "Could not confirm the code email. Check your inbox before trying again.",
          typeof value.code === "string" ? value.code : "send_unknown",
          response.status,
          [],
          retryAt,
        );
      } finally {
        clearTimeout(timer);
        busy = false;
      }
    },
  };
}
