export const REMINDER_CHANNEL = "weekly-job-reminders";
export const REMINDER_PREFIX = "firstjobly-weekly-v1-";
export const REMINDER_VERSION = 1;
/** Expo weekday numbering: 1 Sunday, 2 Monday, 5 Thursday. Native weekly
 * calendar triggers follow the phone's local clock, using the device calendar. */
export const WEEKLY_REMINDERS = [
  {
    slot: "sun-1930",
    weekday: 1,
    hour: 19,
    minute: 30,
    title: "Plan your job search",
    body: "Explore opportunities and plan your week on FirstJobly.",
  },
  {
    slot: "mon-0600",
    weekday: 2,
    hour: 6,
    minute: 0,
    title: "Start your week with FirstJobly",
    body: "Explore jobs, save opportunities and keep your search moving.",
  },
  {
    slot: "mon-1930",
    weekday: 2,
    hour: 19,
    minute: 30,
    title: "Make time for your next step",
    body: "Revisit saved jobs or explore opportunities on FirstJobly.",
  },
  {
    slot: "thu-0600",
    weekday: 5,
    hour: 6,
    minute: 0,
    title: "Keep your job search moving",
    body: "Take a look at opportunities that fit your goals.",
  },
  {
    slot: "thu-1930",
    weekday: 5,
    hour: 19,
    minute: 30,
    title: "Your next opportunity starts here",
    body: "Explore jobs and prepare for your next step on FirstJobly.",
  },
] as const;
export const REMINDER_TIMES =
  "Sunday 19:30 · Monday 06:00 and 19:30 · Thursday 06:00 and 19:30";
export type Reminder = (typeof WEEKLY_REMINDERS)[number];
export const reminderId = (slot: string) => REMINDER_PREFIX + slot;
