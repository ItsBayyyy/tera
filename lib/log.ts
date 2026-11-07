type Level = "info" | "warn" | "error";

/** One JSON line per event so hosting logs stay searchable; never pass images, embeddings or phone numbers. */
export function logEvent(level: Level, event: string, fields: Record<string, string | number | boolean | null>) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
