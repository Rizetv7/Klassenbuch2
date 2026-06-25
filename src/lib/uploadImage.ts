// Client-side image upload helper. Compresses/resizes the image in the browser
// before sending it, so the request stays well under the serverless body limit
// (Vercel rejects requests larger than ~4.5 MB with a 413 error).

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function compressImage(file: File, maxDim = 1920, quality = 0.82): Promise<Blob> {
  // Leave GIFs (animation) and non-images untouched.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const img = await loadImage(file);
    let { width, height } = img;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", quality)
    );
    // Use the smaller of the two (compression sometimes inflates tiny images).
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch {
    return file; // fall back to the original on any failure
  }
}

export async function uploadImageFile(file: File): Promise<string> {
  const blob = await compressImage(file);
  const filename = blob === file ? file.name || "upload" : "photo.jpg";

  const fd = new FormData();
  fd.append("file", blob, filename);

  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const text = await res.text();
  let data: { url?: string; error?: string } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    // non-JSON (e.g. platform error)
  }
  if (!res.ok) {
    throw new Error(data?.error || `Upload fehlgeschlagen (Status ${res.status}). ${text.slice(0, 140)}`);
  }
  if (!data?.url) throw new Error("Upload: keine Bild-URL erhalten.");
  return data.url;
}
