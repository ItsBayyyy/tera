import { MapPin } from "lucide-react";

/**
 * A generic map search: the maps app resolves "terdekat" with the phone's own location, so nothing
 * personal goes into the URL and no API key is needed. It works even before admins enter facilities.
 */
export const NEARBY_CARE_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "puskesmas atau rumah sakit terdekat",
)}`;

export function NearbyCareLink() {
  return (
    <a
      href={NEARBY_CARE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-center font-semibold text-on-accent hover:bg-accent-hover"
    >
      <MapPin aria-hidden="true" className="size-5 shrink-0" />
      Buka peta puskesmas &amp; rumah sakit terdekat
    </a>
  );
}
