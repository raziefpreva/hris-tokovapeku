// WIB (GMT+7) date helpers. Use these everywhere instead of toISOString().slice(0,10),
// which returns the UTC date and is off-by-one for users east of UTC after local midnight.

export function todayWIB(): string {
  return toWIBDateString(new Date());
}

export function toWIBDateString(d: Date): string {
  // Shift to WIB (UTC+7) then read UTC parts to format YYYY-MM-DD.
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wib.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

import { useEffect, useState } from "react";

/** React hook: returns today's WIB date string and auto-rolls over at WIB midnight. */
export function useTodayWIB(): string {
  const [today, setToday] = useState<string>(() => todayWIB());
  useEffect(() => {
    const id = setInterval(() => {
      const next = todayWIB();
      setToday((prev) => (prev === next ? prev : next));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return today;
}