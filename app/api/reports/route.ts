import { after } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { clientIp, fail, fieldErrors, formObject, json, readImage } from "@/lib/api";
import { reportSchema } from "@/lib/validation/report";
import { generateCaseCode } from "@/lib/case-code";
import { roundCoordinate } from "@/lib/geo";
import { createRateLimiter } from "@/lib/rate-limit";
import { matchReportPhoto } from "@/lib/reports";
import { logEvent } from "@/lib/log";

const limit = createRateLimiter(5, 10 * 60 * 1000);
const FIELDS = ["bittenAt", "bodyPart", "banjarId", "lat", "lon", "contactPhone", "consent"] as const;

/** Citizen bite report. No login; validated, rate-limited, written with the service role. */
export async function POST(request: Request) {
  const allowed = limit(clientIp(request));
  if (!allowed.ok) {
    return fail(429, "Terlalu banyak laporan dari perangkat ini. Tunggu sebentar, atau telepon 119 bila darurat.");
  }

  const form = await request.formData();
  const parsed = reportSchema.safeParse(formObject(form, FIELDS));
  if (!parsed.success) return fail(400, "Periksa isian yang ditandai.", fieldErrors(parsed.error));
  const photo = readImage(form.get("photo"));
  if (photo === "invalid") return fail(400, "Foto harus JPEG/PNG/WebP dan maksimal 5 MB.");

  const report = parsed.data;
  const db = getAdminClient();
  const row = {
    bitten_at: report.bittenAt ?? null,
    body_part: report.bodyPart ?? null,
    banjar_id: report.banjarId ?? null,
    lat: report.lat === undefined ? null : roundCoordinate(report.lat),
    lon: report.lon === undefined ? null : roundCoordinate(report.lon),
    contact_phone: report.consent ? (report.contactPhone ?? null) : null,
    contact_consent: report.consent,
  };

  let created: { id: string; case_code: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const { data, error } = await db
      .from("bite_reports")
      .insert({ ...row, case_code: generateCaseCode() })
      .select("id, case_code")
      .single();
    if (data) created = data;
    else if (error?.code !== "23505") {
      logEvent("error", "report.insert_failed", { code: error?.code ?? null });
      return fail(500, "Laporan belum tersimpan. Coba lagi, atau telepon 119 bila darurat.");
    }
  }
  if (!created) return fail(500, "Laporan belum tersimpan. Coba lagi.");

  if (photo) {
    const path = `${created.id}.jpg`;
    const { error } = await db.storage.from("report-photos").upload(path, photo, { contentType: photo.type });
    if (error) {
      logEvent("error", "report.photo_upload_failed", { message: error.message });
    } else {
      await db.from("bite_reports").update({ photo_path: path }).eq("id", created.id);
      const reportId = created.id;
      after(() => matchReportPhoto(db, reportId, photo, report.banjarId ?? null));
    }
  }

  logEvent("info", "report.created", { photo: Boolean(photo), phone: Boolean(row.contact_phone) });
  return json({ caseCode: created.case_code }, 201);
}
