import { Badge } from "@/components/ui";
import type { VaccineState } from "@/lib/vaccine";
import { formatDate, formatScore, scoreBarWidth } from "@/lib/format";
import type { Zone } from "@/lib/match/zone";

export function VaccineBadge({ state, lastAt }: { state: VaccineState; lastAt: string | null }) {
  if (state === "active") return <Badge tone="ok">Tervaksin · {lastAt ? formatDate(lastAt) : ""}</Badge>;
  if (state === "expired") return <Badge tone="wait">Vaksin kedaluwarsa · {lastAt ? formatDate(lastAt) : ""}</Badge>;
  return <Badge tone="neutral">Belum ada catatan vaksin</Badge>;
}

export const ZONE_LABEL: Record<Zone, string> = {
  strong: "Sangat mirip",
  unsure: "Ragu: periksa manual",
  none: "Tidak ada yang mirip",
};

/** Raw cosine similarity with a plain bar; deliberately not a percentage, which would read as "accuracy". */
export function ScoreBar({ score, zone }: { score: number; zone: Zone }) {
  const fill = zone === "strong" ? "bg-ok" : zone === "unsure" ? "bg-wait-line" : "bg-line-strong";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-muted">Kemiripan</span>
        <span className="tabular text-base font-bold">{formatScore(score)}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${scoreBarWidth(score)}%` }} />
      </div>
    </div>
  );
}

export function DogName({ nickname, color }: { nickname: string | null; color: string }) {
  return <>{nickname ? `${nickname}` : `Anjing ${color.toLowerCase()}`}</>;
}

export function PhotoBox({ url, alt, className = "" }: { url: string | null; alt: string; className?: string }) {
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-sunken text-sm text-ink-muted ${className}`}>Tanpa foto</div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs from private storage
  return <img src={url} alt={alt} className={`bg-sunken object-cover ${className}`} />;
}
