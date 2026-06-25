import { prisma } from "./db";

// Shape used everywhere the frontend renders a post.
export function postInclude(viewerId: string) {
  return {
    author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
    class: { select: { id: true, name: true } },
    subject: { select: { id: true, displayName: true, memberType: true, user: { select: { avatarUrl: true, accentColor: true } } } },
    teacher: { select: { id: true, name: true, subject: true, avatarUrl: true, accentColor: true } },
    topic: { select: { id: true, name: true } },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { id: true } },
  };
}

export function serializePostRows(posts: any[]) {
  return posts.map((p) => ({
      id: p.id,
      board: p.board,
      kind: p.kind,
      text: p.text,
      context: p.context,
      saidByName: p.saidByName,
      anonymous: p.anonymous,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt,
      // hide the author entirely for anonymous posts
      author: p.anonymous ? null : { id: p.author.id, name: p.author.name, avatarUrl: p.author.avatarUrl, accentColor: p.author.accentColor },
      class: p.class,
      subject: p.subject
        ? {
            id: p.subject.id,
            displayName: p.subject.displayName,
            memberType: p.subject.memberType,
            avatarUrl: p.subject.user.avatarUrl,
            accentColor: p.subject.user.accentColor,
          }
        : null,
      teacher: p.teacher,
      topic: p.topic,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: p.likes.length > 0,
    }));
}

export async function serializePosts(postIds: string[], viewerId: string) {
  if (postIds.length === 0) return [];

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds } },
    include: postInclude(viewerId),
  });

  // preserve incoming order
  const byId = new Map(posts.map((p) => [p.id, p]));
  return serializePostRows(postIds.map((id) => byId.get(id)).filter(Boolean));
}
