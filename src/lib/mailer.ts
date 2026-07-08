// Minimal e-mail sending via the Resend HTTP API (no extra dependency).
// Configure RESEND_API_KEY (and optionally MAIL_FROM) in the environment.
// Without a key, dev builds log the mail to the console so the flow stays
// testable; production returns a clear error instead of silently dropping it.

export async function sendCodeMail(to: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mail:dev] Bestätigungscode für ${to}: ${code}`);
      return { ok: true };
    }
    return { ok: false, error: "E-Mail-Versand ist noch nicht eingerichtet. Bitte melde dich mit Name & Passwort an." };
  }

  const from = process.env.MAIL_FROM || "Maturaziitig <onboarding@resend.dev>";
  const subject = `${code} ist dein Maturaziitig-Code`;
  const text = `Dein Bestätigungscode: ${code}\n\nEr ist 10 Minuten gültig. Wenn du das nicht warst, ignoriere diese Mail einfach.`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:24px">
      <p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b7149c;margin:0">Maturaziitig</p>
      <h1 style="font-size:22px;margin:8px 0 16px">Dein Bestätigungscode</h1>
      <p style="font-size:34px;font-weight:800;letter-spacing:.3em;background:#fdf3f8;border-radius:14px;padding:16px 8px;text-align:center;margin:0">${code}</p>
      <p style="font-size:13px;color:#666;margin-top:16px">Der Code ist 10 Minuten gültig. Wenn du das nicht warst, ignoriere diese Mail einfach.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("mail send failed", res.status, body.slice(0, 300));
      return { ok: false, error: "Die E-Mail konnte nicht gesendet werden. Versuch es gleich nochmal." };
    }
    return { ok: true };
  } catch (err) {
    console.error("mail send error", err);
    return { ok: false, error: "Die E-Mail konnte nicht gesendet werden. Versuch es gleich nochmal." };
  }
}
