-- Maturaziitig: Tabellen neu aufsetzen (bringt die DB auf den aktuellen Stand).
-- Sicher: Die App-Tabellen sind leer (Registrieren war noch nie moeglich),
-- es gehen also KEINE echten Daten verloren.
-- Supabase -> SQL Editor -> New query -> alles einfuegen -> Run.

DROP TABLE IF EXISTS "ImportItem", "PollVote", "PollOption", "Poll", "Like", "Comment", "Post", "Membership", "Class", "User" CASCADE;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "accentColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "school" TEXT,
    "gradYear" TEXT,
    "joinCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "memberType" TEXT NOT NULL DEFAULT 'STUDENT',
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subjectMembershipId" TEXT,
    "board" TEXT NOT NULL DEFAULT 'YEARBOOK',
    "kind" TEXT NOT NULL DEFAULT 'QUOTE',
    "text" TEXT,
    "context" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Like" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "multipleChoice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportItem" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'STUDENT',
    "kind" TEXT NOT NULL DEFAULT 'QUOTE',
    "text" TEXT,
    "context" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Class_joinCode_key" ON "Class"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_classId_key" ON "Membership"("userId", "classId");

-- CreateIndex
CREATE INDEX "Post_classId_idx" ON "Post"("classId");

-- CreateIndex
CREATE INDEX "Post_subjectMembershipId_idx" ON "Post"("subjectMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_postId_userId_key" ON "Like"("postId", "userId");

-- CreateIndex
CREATE INDEX "Poll_classId_idx" ON "Poll"("classId");

-- CreateIndex
CREATE INDEX "Poll_authorId_idx" ON "Poll"("authorId");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_pollId_position_key" ON "PollOption"("pollId", "position");

-- CreateIndex
CREATE INDEX "PollVote_pollId_userId_idx" ON "PollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX "PollVote_userId_idx" ON "PollVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_optionId_userId_key" ON "PollVote"("optionId", "userId");

-- CreateIndex
CREATE INDEX "ImportItem_classId_idx" ON "ImportItem"("classId");

-- CreateIndex
CREATE INDEX "ImportItem_createdById_idx" ON "ImportItem"("createdById");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_subjectMembershipId_fkey" FOREIGN KEY ("subjectMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
