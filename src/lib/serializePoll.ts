import { prisma } from "./db";
import { canModerate } from "./classAccess";

type PollAccessMap = Record<string, string | undefined>;

export function pollInclude(viewerId: string) {
  return {
    class: { select: { id: true, name: true } },
    author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
    options: {
      orderBy: { position: "asc" as const },
      include: {
        _count: { select: { votes: true } },
        votes: {
          orderBy: { createdAt: "asc" as const },
          select: {
            userId: true,
            user: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
          },
        },
      },
    },
    votes: { where: { userId: viewerId }, select: { optionId: true } },
  };
}

export function serializePollRows(rows: any[], viewerId?: string, access: PollAccessMap = {}) {
  return rows.map((poll) => {
    const voterIds = new Set<string>();
    for (const option of poll.options) {
      for (const vote of option.votes) voterIds.add(vote.userId);
    }
    const totalVotes = voterIds.size;
    const selectedOptionIds = poll.votes.map((vote: any) => vote.optionId as string);
    const options = poll.options.map((option: any) => {
      const count = option._count.votes as number;
      return {
        id: option.id,
        text: option.text,
        count,
        percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
        selectedByMe: selectedOptionIds.includes(option.id),
        voters: poll.anonymous
          ? []
          : option.votes.map((vote: any) => ({
              id: vote.user.id,
              name: vote.user.name,
              avatarUrl: vote.user.avatarUrl,
              accentColor: vote.user.accentColor,
            })),
      };
    });
    let leader: any | null = null;
    for (const option of options) {
      if (!leader || option.count > leader.count) leader = option;
    }

    return {
      id: poll.id,
      question: poll.question,
      description: poll.description,
      anonymous: poll.anonymous,
      multipleChoice: poll.multipleChoice,
      createdAt: poll.createdAt,
      class: poll.class,
      author: poll.author,
      viewerCanDelete: poll.authorId === viewerId || canModerate(access[poll.classId] || ""),
      options,
      selectedOptionIds,
      votedByMe: selectedOptionIds.length > 0,
      totalVotes,
      leader: leader && leader.count > 0 ? { id: leader.id, text: leader.text, count: leader.count, percent: leader.percent } : null,
    };
  });
}

export async function serializePolls(pollIds: string[], viewerId: string) {
  if (pollIds.length === 0) return [];
  const rows = await prisma.poll.findMany({
    where: { id: { in: pollIds } },
    include: pollInclude(viewerId),
  });
  const classIds = Array.from(new Set(rows.map((row) => row.classId)));
  const memberships = await prisma.membership.findMany({
    where: { userId: viewerId, classId: { in: classIds } },
    select: { classId: true, role: true },
  });
  const access = Object.fromEntries(memberships.map((m) => [m.classId, m.role]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return serializePollRows(pollIds.map((id) => byId.get(id)).filter(Boolean), viewerId, access);
}
