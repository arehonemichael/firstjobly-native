export const DELETE_ACCOUNT_URL =
  "https://firstjobly.co.za/api/app/account/delete";
export type DeletionSession = {
  access_token: string;
  user: { id: string; email?: string };
};
export class AccountDeletionError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 0,
    public methods: string[] = [],
    public retryAt = 0,
    public attemptsLeft?: number,
  ) {
    super(message);
  }
}
const unknownResult = () =>
  new AccountDeletionError(
    "We could not confirm whether deletion finished. Nothing has been cleared from this device. Check your connection, then try again yourself or sign in again. A sign-in error alone does not confirm deletion.",
    "unknown_result",
  );
/** Exactly one POST per explicit call. No refresh/replay, URL tokens, admin
 * operation, x-fj-token header, target ID or guessed deletion request table. */
export function createAccountDeletion(
  getSession: () => Promise<DeletionSession | null>,
  send: typeof fetch = fetch,
  now = Date.now,
  timeoutMs = 60000,
) {
  let busy = false;
  const blocked = new Map<string, number>();
  return {
    async delete(
      owner: string,
      confirmEmail: string,
      password?: string,
      proof?: { userId: string; accessToken: string },
      emailCode?: string,
    ) {
      let retryAt = blocked.get(owner) ?? 0;
      if (retryAt <= now()) {
        blocked.delete(owner);
        retryAt = 0;
      }
      if (busy)
        throw new AccountDeletionError(
          "A deletion request is already running. Please wait.",
          "busy",
        );
      if (retryAt > now())
        throw new AccountDeletionError(
          "Please wait before trying again.",
          "rate_limited",
          429,
          [],
          retryAt,
        );
      busy = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const session = await getSession();
        if (
          !session ||
          session.user.id !== owner ||
          (proof && proof.userId !== owner)
        )
          throw new AccountDeletionError(
            "Your account changed or your session expired. Sign in again before deleting.",
            "auth_required",
            401,
          );
        const email = confirmEmail.trim().toLowerCase();
        if (!email || email !== session.user.email?.trim().toLowerCase())
          throw new AccountDeletionError(
            "Type the email address of the account shown above.",
            "confirmation_mismatch",
            422,
          );
        if (
          emailCode !== undefined &&
          (!/^\d{6}$/.test(emailCode.trim()) ||
            password !== undefined ||
            proof !== undefined)
        )
          throw new AccountDeletionError(
            "Enter the six-digit email code, without another verification method.",
            "invalid_request",
            400,
          );
        const body = JSON.stringify({
          confirmEmail: email,
          ...(password ? { password } : {}),
          ...(emailCode === undefined ? {} : { emailCode: emailCode.trim() }),
        });
        const bytes = [...body].reduce(
          (size, c) =>
            size +
            (c.codePointAt(0)! > 0xffff
              ? 4
              : c.charCodeAt(0) > 0x7ff
                ? 3
                : c.charCodeAt(0) > 0x7f
                  ? 2
                  : 1),
          0,
        );
        if (bytes > 4096)
          throw new AccountDeletionError(
            "The confirmation is too long.",
            "invalid_request",
            400,
          );
        const abort = new AbortController();
        timer = setTimeout(() => abort.abort(), timeoutMs);
        let response: Response, data: unknown;
        try {
          response = await send(DELETE_ACCOUNT_URL, {
            method: "POST",
            headers: {
              Authorization:
                "Bearer " + (proof?.accessToken || session.access_token),
              "Content-Type": "application/json",
            },
            body,
            redirect: "error",
            cache: "no-store",
            signal: abort.signal,
          });
          data = await response.json();
        } catch {
          throw unknownResult();
        }
        const value = data as {
          deleted?: unknown;
          error?: unknown;
          code?: unknown;
          methods?: unknown;
          retry_after_seconds?: unknown;
          attempts_left?: unknown;
        } | null;
        if (response.status === 200 && value?.deleted === true) {
          blocked.delete(owner);
          return { deleted: true as const, owner };
        }
        if (response.ok) throw unknownResult();
        const seconds = Number(
          response.headers.get("Retry-After") || value?.retry_after_seconds,
        );
        if (
          response.status === 429 &&
          Number.isFinite(seconds) &&
          seconds > 0
        ) {
          retryAt = now() + Math.ceil(seconds) * 1000;
          blocked.set(owner, retryAt);
        }
        throw new AccountDeletionError(
          typeof value?.error === "string"
            ? value.error
            : "Deletion could not be confirmed. Please try again yourself.",
          typeof value?.code === "string" ? value.code : "unknown_result",
          response.status,
          Array.isArray(value?.methods)
            ? value.methods.filter((v): v is string => typeof v === "string")
            : [],
          retryAt,
          typeof value?.attempts_left === "number" &&
          Number.isInteger(value.attempts_left) &&
          value.attempts_left >= 0 &&
          value.attempts_left <= 4
            ? value.attempts_left
            : undefined,
        );
      } finally {
        clearTimeout(timer);
        busy = false;
      }
    },
  };
}
