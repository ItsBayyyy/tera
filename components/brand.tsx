import Image from "next/image";
import type { ReactNode } from "react";

/** Logo mark + app name. The mark is decorative; the visible name carries the meaning. */
export function Brand({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
      <Image src="/icon.svg" alt="" width={32} height={32} unoptimized priority className="size-8 rounded-lg" />
      <span>
        Tera{children ? <> {children}</> : null}
      </span>
    </span>
  );
}
