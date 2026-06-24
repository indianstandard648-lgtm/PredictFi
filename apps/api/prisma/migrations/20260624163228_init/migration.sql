-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'LOCKED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketCategory" AS ENUM ('CRYPTO', 'POLITICS', 'SPORTS', 'FINANCE', 'TECH', 'SCIENCE', 'ENTERTAINMENT', 'WORLD_EVENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "PositionSide" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('ACTIVE', 'SETTLED', 'CLAIMED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ResolutionOutcome" AS ENUM ('YES', 'NO', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OracleStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'DISPUTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "twitterHandle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "onchainId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MarketCategory" NOT NULL DEFAULT 'OTHER',
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "creatorId" TEXT NOT NULL,
    "oracleSource" TEXT NOT NULL DEFAULT 'admin',
    "oracleAddress" TEXT,
    "endDate" TIMESTAMP(3) NOT NULL,
    "resolutionDate" TIMESTAMP(3) NOT NULL,
    "totalVolume" DECIMAL(20,7) NOT NULL DEFAULT 0,
    "yesPool" DECIMAL(20,7) NOT NULL DEFAULT 0,
    "noPool" DECIMAL(20,7) NOT NULL DEFAULT 0,
    "yesShares" DECIMAL(20,7) NOT NULL DEFAULT 0,
    "noShares" DECIMAL(20,7) NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "tags" TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" "PositionSide" NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "amountUsdc" DECIMAL(20,7) NOT NULL,
    "sharesOwned" DECIMAL(20,7) NOT NULL,
    "entryProbability" DECIMAL(5,2) NOT NULL,
    "payout" DECIMAL(20,7),
    "profit" DECIMAL(20,7),
    "txHash" TEXT,
    "claimTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcome" "ResolutionOutcome" NOT NULL,
    "resolverId" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "notes" TEXT,
    "txHash" TEXT,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPredictions" INTEGER NOT NULL DEFAULT 0,
    "correctPredictions" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(20,7) NOT NULL DEFAULT 0,
    "totalProfit" DECIMAL(20,7) NOT NULL DEFAULT 0,
    "winRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "accuracy" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "reputationScore" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reputations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "probabilityYes" DECIMAL(5,2) NOT NULL,
    "probabilityNo" DECIMAL(5,2) NOT NULL,
    "yesPool" DECIMAL(20,7) NOT NULL,
    "noPool" DECIMAL(20,7) NOT NULL,
    "volume" DECIMAL(20,7) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oracle_requests" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "OracleStatus" NOT NULL DEFAULT 'PENDING',
    "requestData" TEXT,
    "responseData" TEXT,
    "submittedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "oracle_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_walletAddress_idx" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "markets_contractId_key" ON "markets"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "markets_onchainId_key" ON "markets"("onchainId");

-- CreateIndex
CREATE INDEX "markets_status_idx" ON "markets"("status");

-- CreateIndex
CREATE INDEX "markets_category_idx" ON "markets"("category");

-- CreateIndex
CREATE INDEX "markets_endDate_idx" ON "markets"("endDate");

-- CreateIndex
CREATE INDEX "markets_createdAt_idx" ON "markets"("createdAt");

-- CreateIndex
CREATE INDEX "markets_featured_idx" ON "markets"("featured");

-- CreateIndex
CREATE INDEX "positions_userId_idx" ON "positions"("userId");

-- CreateIndex
CREATE INDEX "positions_marketId_idx" ON "positions"("marketId");

-- CreateIndex
CREATE INDEX "positions_status_idx" ON "positions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "positions_userId_marketId_side_key" ON "positions"("userId", "marketId", "side");

-- CreateIndex
CREATE UNIQUE INDEX "resolutions_marketId_key" ON "resolutions"("marketId");

-- CreateIndex
CREATE INDEX "resolutions_marketId_idx" ON "resolutions"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "reputations_userId_key" ON "reputations"("userId");

-- CreateIndex
CREATE INDEX "reputations_reputationScore_idx" ON "reputations"("reputationScore" DESC);

-- CreateIndex
CREATE INDEX "reputations_rank_idx" ON "reputations"("rank");

-- CreateIndex
CREATE INDEX "price_snapshots_marketId_recordedAt_idx" ON "price_snapshots"("marketId", "recordedAt");

-- CreateIndex
CREATE INDEX "oracle_requests_marketId_idx" ON "oracle_requests"("marketId");

-- CreateIndex
CREATE INDEX "oracle_requests_status_idx" ON "oracle_requests"("status");

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputations" ADD CONSTRAINT "reputations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
