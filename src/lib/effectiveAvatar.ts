import { prisma } from "./db";

// The "effective" profile picture of a student/teacher is the manually chosen
// avatar if there is one, otherwise the newest image that was posted about that
// person. These helpers resolve that fallback in bulk so it can be shown
// everywhere (grids, post cards, feed) without an N+1 query.

// membership id -> newest posted image about that student
export async function firstImageBySubject(
  membershipIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(membershipIds.filter((id): id is string => !!id)));
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const rows = await prisma.post.findMany({
    where: { subjectMembershipId: { in: ids }, imageUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { subjectMembershipId: true, imageUrl: true },
  });
  for (const r of rows) {
    if (r.subjectMembershipId && r.imageUrl && !map.has(r.subjectMembershipId)) {
      map.set(r.subjectMembershipId, r.imageUrl);
    }
  }
  return map;
}

// teacher id -> newest posted image about that teacher
export async function firstImageByTeacher(
  teacherIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(teacherIds.filter((id): id is string => !!id)));
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const rows = await prisma.post.findMany({
    where: { teacherId: { in: ids }, imageUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { teacherId: true, imageUrl: true },
  });
  for (const r of rows) {
    if (r.teacherId && r.imageUrl && !map.has(r.teacherId)) {
      map.set(r.teacherId, r.imageUrl);
    }
  }
  return map;
}
