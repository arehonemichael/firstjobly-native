const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./ads-load.cjs");
const { createWeeklyReminders } = load("src/lib/reminders/controller.ts");
const { WEEKLY_REMINDERS, REMINDER_PREFIX, REMINDER_VERSION, reminderId } =
  load("src/lib/reminders/schedule.ts");
const { notificationDestination } = load("src/lib/circular/links.ts");
function fixture({ raw = null, permission = "granted", failAt = 0 } = {}) {
  let stored = raw,
    perm = permission,
    scheduled = 0,
    requests = 0;
  const records = new Map([
    ["unrelated", { identifier: "unrelated", version: 0 }],
  ]);
  const port = {
    read: async () => stored,
    write: async (value) => {
      stored = value;
    },
    setup: async () => {},
    permission: async (request) => {
      if (request) requests++;
      return perm;
    },
    list: async () => [...records.values()],
    cancel: async (id) => {
      records.delete(id);
    },
    schedule: async (r) => {
      scheduled++;
      if (failAt && scheduled === failAt) throw Error("OS rejected");
      const id = reminderId(r.slot);
      records.set(id, {
        identifier: id,
        version: REMINDER_VERSION,
        context: port.calendarContext?.(),
      });
    },
  };
  return {
    port,
    controller: createWeeklyReminders(port),
    records,
    get stored() {
      return stored;
    },
    get scheduled() {
      return scheduled;
    },
    get requests() {
      return requests;
    },
    permission(value) {
      perm = value;
    },
  };
}
test("exactly five requested weekly slots, Sunday=1 Monday=2 Thursday=5", () => {
  assert.deepEqual(
    WEEKLY_REMINDERS.map(({ weekday, hour, minute }) => [
      weekday,
      hour,
      minute,
    ]),
    [
      [1, 19, 30],
      [2, 6, 0],
      [2, 19, 30],
      [5, 6, 0],
      [5, 19, 30],
    ],
  );
  assert.equal(
    new Set(WEEKLY_REMINDERS.map((r) => reminderId(r.slot))).size,
    5,
  );
});
test("fresh signed-out device requests no permission/schedule until explicit enable", async () => {
  const f = fixture();
  await f.controller.refresh();
  assert.equal(f.scheduled, 0);
  assert.equal(f.requests, 0);
  assert.equal(f.controller.getSnapshot().enabled, false);
  assert.equal(f.controller.getSnapshot().ready, true);
  await f.controller.setEnabled(true);
  assert.equal(f.requests, 1);
  assert.equal(f.scheduled, 5);
  assert.equal(f.controller.getSnapshot().active, true);
  assert.equal(f.records.has("unrelated"), true);
});
test("repeated mounts/resumes/enables keep exactly five schedules", async () => {
  const f = fixture();
  await Promise.all([
    f.controller.refresh(),
    f.controller.refresh(),
    f.controller.setEnabled(true),
    f.controller.setEnabled(true),
    f.controller.refresh(),
  ]);
  assert.equal(f.scheduled, 5);
  assert.equal(f.records.size, 6);
});
test("persisted opt-in restores on process restart without a permission prompt", async () => {
  const f = fixture({
    raw: JSON.stringify({ enabled: true, dismissed: true }),
  });
  await f.controller.refresh();
  assert.equal(f.scheduled, 5);
  assert.equal(f.requests, 0);
  assert.equal(f.controller.getSnapshot().active, true);
});
test("disable cancels only owned notifications and remains disabled on refresh", async () => {
  const f = fixture();
  await f.controller.setEnabled(true);
  await f.controller.setEnabled(false);
  await f.controller.refresh();
  assert.equal(f.records.size, 1);
  assert.equal(f.records.has("unrelated"), true);
  assert.equal(f.controller.getSnapshot().enabled, false);
  assert.equal(JSON.parse(f.stored).enabled, false);
});
test("serialized enable/disable race honors latest choice without leaving extra schedules", async () => {
  const f = fixture();
  await Promise.all([
    f.controller.setEnabled(true),
    f.controller.setEnabled(false),
  ]);
  assert.equal(f.records.size, 1);
  assert.equal(f.controller.getSnapshot().enabled, false);
});
test("permission denial never claims reminders are scheduled", async () => {
  const f = fixture({ permission: "denied" });
  await f.controller.setEnabled(true);
  assert.equal(f.scheduled, 0);
  assert.equal(f.controller.getSnapshot().active, false);
  assert.equal(f.controller.getSnapshot().enabled, false);
  assert.equal(f.controller.getSnapshot().permission, "denied");
});
test("permission revoked in OS cancels owned schedules; grant later restores chosen opt-in", async () => {
  const f = fixture();
  await f.controller.setEnabled(true);
  f.permission("denied");
  await f.controller.refresh();
  assert.equal(f.records.size, 1);
  assert.equal(f.controller.getSnapshot().active, false);
  assert.equal(f.controller.getSnapshot().enabled, true);
  f.permission("granted");
  await f.controller.refresh();
  assert.equal(f.records.size, 6);
});
test("partial scheduling failure cleans only own schedules and retry restores intended opt-in", async () => {
  const f = fixture({ failAt: 3 });
  await f.controller.setEnabled(true);
  assert.equal(f.records.size, 1);
  assert.ok(f.controller.getSnapshot().error);
  assert.equal(f.controller.getSnapshot().active, false);
  await f.controller.refresh();
  assert.equal(f.controller.getSnapshot().active, true);
  assert.equal(f.records.size, 6);
});
test("stale/duplicate records are replaced as one five-slot set", async () => {
  const f = fixture({
    raw: JSON.stringify({ enabled: true, dismissed: true }),
  });
  f.records.set(REMINDER_PREFIX + "old", {
    identifier: REMINDER_PREFIX + "old",
    version: 0,
  });
  await f.controller.refresh();
  assert.equal(f.records.size, 6);
  assert.equal(f.scheduled, 5);
});
test("Not now persists dismissal and does not request permission", async () => {
  const f = fixture();
  await f.controller.dismiss();
  assert.equal(f.requests, 0);
  assert.equal(f.controller.getSnapshot().dismissed, true);
  assert.equal(f.scheduled, 0);
  assert.equal(JSON.parse(f.stored).dismissed, true);
});
test("web/Expo Go unsupported port is safe and never initializes native SDK", async () => {
  const f = createWeeklyReminders(null);
  await f.refresh();
  await f.setEnabled(true);
  assert.equal(f.getSnapshot().supported, false);
  assert.equal(f.getSnapshot().enabled, false);
});
test("reminder taps use a fixed public Jobs destination and reject external routes", () => {
  assert.equal(
    notificationDestination({ kind: "weekly_job_reminder", link: "/jobs" }),
    "/jobs",
  );
  assert.equal(
    notificationDestination({
      kind: "weekly_job_reminder",
      link: "https://bad.example/jobs",
    }),
    null,
  );
});
const { createReminderPort } = load("src/lib/reminders/native-port.ts");
for (const platform of ["ios", "android"])
  test(`${platform} native adapter creates the five repeating weekly trigger payloads without remote tokens`, async () => {
    const scheduled = [],
      channels = [];
    let requested = 0,
      handler;
    const api = {
      AndroidImportance: { DEFAULT: 3 },
      IosAuthorizationStatus: { PROVISIONAL: 3 },
      SchedulableTriggerInputTypes: { WEEKLY: "weekly" },
      setNotificationChannelAsync: async (...args) => channels.push(args),
      setNotificationHandler: (value) => {
        handler = value;
      },
      getPermissionsAsync: async () => ({ granted: false, canAskAgain: true }),
      requestPermissionsAsync: async () => {
        requested++;
        return { granted: true };
      },
      scheduleNotificationAsync: async (value) => scheduled.push(value),
      getAllScheduledNotificationsAsync: async () => [],
      cancelScheduledNotificationAsync: async () => {},
    };
    const port = createReminderPort(
      async () => api,
      { getItem: async () => null, setItem: async () => {} },
      platform,
    );
    await port.setup();
    assert.equal(channels.length, platform === "android" ? 1 : 0);
    assert.equal(await port.permission(false), "undetermined");
    assert.equal(requested, 0);
    assert.equal(await port.permission(true), "granted");
    assert.equal(requested, 1);
    for (const r of WEEKLY_REMINDERS) await port.schedule(r);
    assert.deepEqual(
      scheduled.map((r) => [
        r.trigger.type,
        r.trigger.weekday,
        r.trigger.hour,
        r.trigger.minute,
      ]),
      WEEKLY_REMINDERS.map((r) => ["weekly", r.weekday, r.hour, r.minute]),
    );
    assert.ok(
      scheduled.every(
        (r) =>
          r.content.data.link === "/jobs" &&
          r.content.data.kind === "weekly_job_reminder",
      ),
    );
    assert.equal(
      (
        await handler.handleNotification({
          request: { content: { data: { kind: "weekly_job_reminder" } } },
        })
      ).shouldShowBanner,
      true,
    );
    assert.equal(
      (
        await handler.handleNotification({
          request: { content: { data: { kind: "other" } } },
        })
      ).shouldShowBanner,
      false,
    );
  });
test("corrupt local preference is repaired safely without treating it as consent", async () => {
  const f = fixture({ raw: "broken" });
  await f.controller.refresh();
  assert.equal(f.controller.getSnapshot().enabled, false);
  assert.equal(f.requests, 0);
  assert.equal(f.controller.getSnapshot().error, null);
  assert.equal(JSON.parse(f.stored).enabled, false);
});

test("timezone/offset change rebuilds calendar alarms on foreground refresh", async () => {
  const f = fixture();
  let zone = "Africa/Johannesburg:-120";
  f.port.calendarContext = () => zone;
  await f.controller.setEnabled(true);
  assert.equal(f.scheduled, 5);
  zone = "Europe/London:0";
  await f.controller.refresh();
  assert.equal(f.scheduled, 10);
  assert.equal(f.records.size, 6);
});
