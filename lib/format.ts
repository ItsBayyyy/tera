const scoreFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const percentFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Similarity is shown as a raw cosine score ("0,82"), never as a fake accuracy percentage. */
export function formatScore(score: number): string {
  return scoreFormat.format(score);
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatPercent(part: number, whole: number): string {
  if (whole === 0) return "–";
  return `${percentFormat.format((part / whole) * 100)}%`;
}

/** Width for a similarity bar; scores below zero render as an empty bar. */
export function scoreBarWidth(score: number): number {
  return Math.round(Math.min(Math.max(score, 0), 1) * 100);
}
