// Timezone-aware date/time formatting — every render site takes the org's
// configured IANA zone explicitly rather than trusting the browser's (or, for
// server components running on Vercel, the server's UTC) local zone.

export function formatShortDate(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: timezone });
}

export function formatLongDate(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  });
}

export function formatDateTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: timezone });
}

export function formatTodayHeader(timezone: string): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });
}

export function formatCurrentTime(timezone: string): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function greetingFor(timezone: string): { emoji: string; label: string } {
  const rawHour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date()),
  );
  const hour = rawHour % 24;
  if (hour < 12) return { emoji: "🌅", label: "Good Morning" };
  if (hour < 17) return { emoji: "☀️", label: "Good Afternoon" };
  return { emoji: "🌙", label: "Good Evening" };
}

function dateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

export function relativeDayLabel(iso: string, timezone: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone });

  if (dateKey(d, timezone) === dateKey(now, timezone)) return `Today · ${time}`;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (dateKey(d, timezone) === dateKey(yesterday, timezone)) return `Yesterday · ${time}`;
  return `${formatShortDate(iso, timezone)} · ${time}`;
}
