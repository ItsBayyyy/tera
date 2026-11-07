import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border-2 border-line-strong bg-surface text-ink hover:bg-sunken",
  danger: "bg-danger text-white hover:bg-danger-hover",
  ghost: "text-accent underline-offset-4 hover:underline",
};

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55";

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${BASE} ${VARIANT_CLASS[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`rounded-card border border-line bg-surface p-4 ${className}`} {...props} />;
}

type Tone = "ok" | "wait" | "danger" | "neutral" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  wait: "bg-wait-soft text-wait",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-sunken text-ink-muted",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function Notice({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  return (
    <div className={`rounded-xl p-4 ${TONE_CLASS[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-[0.95rem] leading-relaxed text-ink">{children}</div> : null}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm font-medium text-danger">
      {message}
    </p>
  );
}

export const inputClass =
  "mt-1 block min-h-12 w-full rounded-xl border-2 border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none";

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[0.95rem] font-semibold text-ink">
      {children}
      {hint ? <span className="ml-1 font-normal text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-sunken ${className}`} />;
}

export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border-2 border-dashed border-line px-4 py-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-sm text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, children, onRetry }: { title: string; children?: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border-2 border-danger/40 bg-danger-soft px-4 py-6">
      <p className="font-semibold text-danger">{title}</p>
      {children ? <div className="mt-1 text-ink">{children}</div> : null}
      {onRetry ? (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}
