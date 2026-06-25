import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getSessionUserId } from "@/lib/auth";

// Image upload.
//
// In production we upload to Supabase Storage (set SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY in the environment). This keeps images on durable
// object storage — required because serverless hosts like Vercel have a
// read-only / ephemeral filesystem.
//
// If those env vars are missing (e.g. local development), we fall back to
// writing into /public/uploads so things still work without any setup.

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (under Vercel's request body limit)
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "uploads";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Nur Bilder (JPG, PNG, WEBP, GIF) erlaubt." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Bild ist zu groß (max. 4 MB)." }, { status: 400 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // --- Production path: Supabase Storage ---
  if (supabaseUrl && serviceKey) {
    const base = supabaseUrl.replace(/\/+$/, ""); // strip trailing slash
    // Supabase's gateway requires BOTH the apikey header and the Bearer token.
    const authHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    const doUpload = () =>
      fetch(`${base}/storage/v1/object/${BUCKET}/${filename}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": file.type, "x-upsert": "true" },
        body: bytes,
      });

    try {
      let uploadRes = await doUpload();

      // If the bucket doesn't exist yet, create it (public) and retry once.
      if (!uploadRes.ok && (uploadRes.status === 400 || uploadRes.status === 404)) {
        await fetch(`${base}/storage/v1/bucket`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
        }).catch(() => null);
        // make sure it is public even if it already existed as private
        await fetch(`${base}/storage/v1/bucket/${BUCKET}`, {
          method: "PUT",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ public: true }),
        }).catch(() => null);
        uploadRes = await doUpload();
      }

      if (!uploadRes.ok) {
        const detail = await uploadRes.text().catch(() => "");
        console.error("supabase upload failed", uploadRes.status, detail);
        return NextResponse.json(
          { error: `Speicher-Upload fehlgeschlagen (Status ${uploadRes.status}). ${detail.slice(0, 160)}` },
          { status: 500 }
        );
      }
      const publicUrl = `${base}/storage/v1/object/public/${BUCKET}/${filename}`;
      return NextResponse.json({ url: publicUrl });
    } catch (err) {
      console.error("supabase upload error", err);
      return NextResponse.json({ error: "Upload fehlgeschlagen (Verbindung zum Speicher)." }, { status: 500 });
    }
  }

  // --- Local fallback: filesystem ---
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), bytes);
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("fs upload error", err);
    return NextResponse.json(
      { error: "Bild-Speicher nicht konfiguriert. Bitte SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen." },
      { status: 500 }
    );
  }
}
