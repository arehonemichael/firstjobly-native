import {
  WEEKLY_REMINDERS,
  REMINDER_PREFIX,
  REMINDER_VERSION,
  reminderId,
  type Reminder,
} from "./schedule";
export type Permission = "granted" | "denied" | "undetermined";
type Record = { identifier: string; version?: unknown; context?: unknown };
export type ReminderPort = {
  calendarContext?(): string;
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  setup(): Promise<void>;
  permission(request: boolean): Promise<Permission>;
  list(): Promise<Record[]>;
  cancel(id: string): Promise<void>;
  schedule(reminder: Reminder): Promise<void>;
};
type State = {
  supported: boolean;
  ready: boolean;
  busy: boolean;
  enabled: boolean;
  active: boolean;
  dismissed: boolean;
  permission: Permission;
  error: string | null;
};
/** Device-wide opt-in, deliberately independent of authentication. Serialized
 * operations prevent repeat mounts/resumes/taps creating duplicate schedules. */
export function createWeeklyReminders(port: ReminderPort | null) {
  let state: State = {
    supported: !!port,
    ready: !port,
    busy: false,
    enabled: false,
    active: false,
    dismissed: false,
    permission: "undetermined",
    error: null,
  };
  let loaded = false,
    queue = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<State>) => {
    state = { ...state, ...patch };
    for (const fn of listeners) fn();
  };
  async function cancelOwned() {
    for (const item of await port!.list())
      if (item.identifier.startsWith(REMINDER_PREFIX))
        await port!.cancel(item.identifier);
  }
  async function reconcile(enabled: boolean, permission: Permission) {
    const records = (await port!.list()).filter((item) =>
      item.identifier.startsWith(REMINDER_PREFIX),
    );
    if (!enabled || permission !== "granted") {
      for (const item of records) await port!.cancel(item.identifier);
      return false;
    }
    if (
      records.length === WEEKLY_REMINDERS.length &&
      WEEKLY_REMINDERS.every(
        (r) =>
          records.filter(
            (item) =>
              item.identifier === reminderId(r.slot) &&
              item.version === REMINDER_VERSION &&
              item.context === port!.calendarContext?.(),
          ).length === 1,
      )
    )
      return true;
    for (const item of records) await port!.cancel(item.identifier);
    try {
      for (const reminder of WEEKLY_REMINDERS) await port!.schedule(reminder);
    } catch (error) {
      await cancelOwned();
      throw error;
    }
    return true;
  }
  async function initialize() {
    if (loaded) return;
    const raw = await port!.read();
    if (raw) {
      try {
        const value = JSON.parse(raw);
        if (
          typeof value.enabled !== "boolean" ||
          typeof value.dismissed !== "boolean"
        )
          throw Error("Invalid reminder preference");
        publish({ enabled: value.enabled, dismissed: value.dismissed });
      } catch {
        // An unreadable preference is never treated as consent to notify.
        await port!.write(JSON.stringify({ enabled: false, dismissed: false }));
        publish({ enabled: false, dismissed: false });
      }
    }
    await port!.setup();
    loaded = true;
  }
  function run(action: () => Promise<void>) {
    if (!port) return Promise.resolve();
    const task = queue.then(async () => {
      publish({ busy: true, error: null });
      try {
        await initialize();
        await action();
      } catch {
        publish({
          active: false,
          error:
            "Could not update weekly reminders. Check device notification settings and try again.",
        });
      } finally {
        publish({ busy: false, ready: true });
      }
    });
    queue = task.catch(() => {});
    return task;
  }
  const refresh = () =>
    run(async () => {
      const permission = await port!.permission(false);
      const active = await reconcile(state.enabled, permission);
      publish({ permission, active });
    });
  return {
    refresh,
    setEnabled(enabled: boolean) {
      return run(async () => {
        const permission = await port!.permission(enabled);
        const wanted = enabled && permission === "granted";
        await port!.write(JSON.stringify({ enabled: wanted, dismissed: true }));
        publish({
          enabled: wanted,
          active: false,
          permission,
          dismissed: true,
        });
        const active = await reconcile(wanted, permission);
        publish({ active });
      });
    },
    dismiss() {
      return run(async () => {
        await port!.write(
          JSON.stringify({ enabled: state.enabled, dismissed: true }),
        );
        publish({ dismissed: true });
      });
    },
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
