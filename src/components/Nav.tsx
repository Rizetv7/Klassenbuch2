"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { id: string; name: string; avatarUrl: string | null } | null;

export function Nav() {
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .finally(() => setLoaded(true));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-brand-700">
          📓 Klassenbuch
        </Link>
        <nav className="flex items-center gap-2">
          {!loaded ? null : me ? (
            <>
              <Link href="/" className="btn-ghost">Feed</Link>
              <Link href="/classes" className="btn-ghost">Klassen</Link>
              <Link href="/profile" className="flex items-center gap-2">
                <Avatar name={me.name} url={me.avatarUrl} size={32} />
              </Link>
              <button onClick={logout} className="btn-ghost">Abmelden</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Anmelden</Link>
              <Link href="/register" className="btn-primary">Registrieren</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover bg-gray-100"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="rounded-full bg-brand-100 text-brand-700 font-semibold inline-flex items-center justify-center"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </span>
  );
}
