-- CreateTable
CREATE TABLE "slack_installations" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamDomain" TEXT,
    "teamIcon" TEXT,
    "enterpriseId" TEXT,
    "appId" TEXT,
    "botUserId" TEXT NOT NULL,
    "botTokenEncrypted" TEXT NOT NULL,
    "scopes" TEXT[],
    "installedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_installations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_installations_teamId_key" ON "slack_installations"("teamId");

-- AddForeignKey
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
