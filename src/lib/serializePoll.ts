import { prisma } from "./db";

export function pollInclude(viewerId: string) {
  return {
    class: { select: { id: true, name: true } },
    author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
    options: {
      orderBy: { position: "asc" as const },
      include: {
        _count: { select: { votes: true } },
        votes: { where: { userId: viewerId }, select: { id: true } },
      },
    },
    votes: { where: { userId: viewerId }, select: { optionId: true } },
  };
}

export function serializePollRows(rows: any[]) {
  return rows.map((poll) => {
    const counts = poll.options.map((option: any) => option._count.votes as number);
    const totalVotes = counts.reduce((sum: number, count: number) => sum + count, 0);
    const selectedOptionIds = poll.votes.map((vote: any) => vote.optionId as string);
    const options = poll.options.map((option: any) => {
      const count = option._count.votes as number;
      return {
        id: option.id,
        text: option.text,
        count,
        percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
        selectedByMe: option.votes.length > 0,
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
      author: poll.anonymous ? null : poll.author,
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
  const byId = new Map(rows.map((row) => [row.id, row]));
  return serializePollRows(pollIds.map((id) => byId.get(id)).filter(Boolean));
}
