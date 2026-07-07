import { Avatar } from "./Nav";
import type { Post } from "./PostCard";

// Who UPLOADED a post (never the person it is about). Anonymous posts hide it.
export function uploaderPerson(post: Post) {
  if (post.anonymous || !post.author) {
    return { name: "Anonym", avatarUrl: null as string | null, accentColor: null as string | null };
  }
  return {
    name: post.author.name,
    avatarUrl: post.author.avatarUrl,
    accentColor: post.author.accentColor ?? null,
  };
}

// Attribution block for the home surfaces. The avatar is always the uploader,
// with a tiny role label above the name so it reads clearly as "who posted
// this" — hierarchical, minimal text, and never confused with a quote's
// speaker or a photo's subject (those are shown elsewhere as kickers/chips).
export function HomeAttribution({
  post,
  compact = false,
  prominent = false,
  inverted = false,
  photo = false,
}: {
  post: Post;
  compact?: boolean;
  prominent?: boolean;
  inverted?: boolean;
  photo?: boolean;
}) {
  const uploader = uploaderPerson(post);
  const nameClass = inverted ? "text-snow" : "text-ink";
  const labelClass = inverted ? "text-snow/70" : "text-ink/45";
  const size = prominent ? 34 : compact ? 24 : 28;
  return (
    <div className={`flex min-w-0 items-center gap-2 ${photo ? "" : "mt-3"}`}>
      <Avatar name={uploader.name} url={uploader.avatarUrl} accent={uploader.accentColor} size={size} ring={!inverted} />
      <div className="min-w-0 leading-none">
        <p className={`text-[9px] font-black uppercase tracking-wide ${labelClass}`}>hochgeladen von</p>
        <p className={`mt-0.5 truncate font-black ${prominent ? "text-sm" : "text-xs"} ${nameClass}`}>{uploader.name}</p>
      </div>
    </div>
  );
}
