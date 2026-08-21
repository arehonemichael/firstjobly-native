export function getSouthAfricaTodayISO(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Johannesburg is UTC+2 year-round.
  }

  const shifted = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function openClosingDateFilter(date = new Date()) {
  return `closing_date.is.null,closing_date.gte.${getSouthAfricaTodayISO(date)}`;
}

export function isJobOpen(job: {
  is_active?: boolean | null;
  closing_date?: string | null;
}) {
  if (job.is_active === false) return false;
  if (!job.closing_date) return true;
  return job.closing_date.slice(0, 10) >= getSouthAfricaTodayISO();
}
