-- AddForeignKey
ALTER TABLE "oracle_requests" ADD CONSTRAINT "oracle_requests_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
