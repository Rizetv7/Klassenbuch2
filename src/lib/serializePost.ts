import { prisma } from "./db";

// Shape used everywhere the frontend renders a post.
export async function serializePosts(postIds: string[], viewerId: string) {
  if (postIds.length === 0) return [];

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds } },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, displayName: true, memberType: true } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId: viewerId }, select: { id: true } },
    },
  });

  // preserve incoming order
  const byId = new Map(posts.map((p) => [p.id, p]));
  return postIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      id: p.id,
      board: p.board,
      kind: p.kind,
      text: p.text,
      context: p.context,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt,
      author: p.author,
      class: p.class,
      subject: p.subject,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: p.likes.length > 0,
    }));
}
