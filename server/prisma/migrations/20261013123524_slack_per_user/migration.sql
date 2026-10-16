/*
  Warnings:

  - You are about to drop the `slack_installations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "slack_installations" DROP CONSTRAINT "slack_installations_installedById_fkey";

-- DropTable
DROP TABLE "slack_installations";

-- CreateTable
CREATE TABLE "slack_workspaces" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamDomain" TEXT,
    "teamIcon" TEXT,
    "enterpriseId" TEXT,
    "appId" TEXT,
    "botUserId" TEXT NOT NULL,
    "botTokenEncrypted" TEXT NOT NULL,
    "botScopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "slackUserName" TEXT,
    "slackUserAvatar" TEXT,
    "slackUserEmail" TEXT,
    "userTokenEncrypted" TEXT,
    "userScopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_workspaces_teamId_key" ON "slack_workspaces"("teamId");

-- CreateIndex
CREATE INDEX "slack_connections_workspaceId_idx" ON "slack_connections"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "slack_connections_userId_workspaceId_key" ON "slack_connections"("userId", "workspaceId");

-- AddForeignKey
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
