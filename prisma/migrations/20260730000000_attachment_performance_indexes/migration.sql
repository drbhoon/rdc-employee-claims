CREATE INDEX "ClaimHeader_employeeId_createdAt_idx" ON "ClaimHeader"("employeeId", "createdAt");
CREATE INDEX "ClaimHeader_currentStatus_currentPendingWith_idx" ON "ClaimHeader"("currentStatus", "currentPendingWith");
CREATE INDEX "ClaimHeader_finalApprovedAt_idx" ON "ClaimHeader"("finalApprovedAt");
CREATE INDEX "ClaimLine_claimHeaderId_idx" ON "ClaimLine"("claimHeaderId");
CREATE INDEX "ClaimAttachment_claimLineId_idx" ON "ClaimAttachment"("claimLineId");
CREATE INDEX "ClaimApprovalHistory_claimHeaderId_actionDate_idx" ON "ClaimApprovalHistory"("claimHeaderId", "actionDate");
