export interface AuditChainNode {
  sequenceIndex: number;
  bidId: string;
  bidderPseudonym: string;
  amountCents: number;
  createdAt: string;
  previousHash: string | null;
  hash: string;
  isValid: boolean;
}

export interface AuditViolation {
  bidId: string;
  sequenceIndex: number;
  reason: string;
  expectedHash?: string;
  actualHash?: string;
}

export interface LotAuditResult {
  lotId: string;
  lotTitle: string;
  status: 'INTEGRO' | 'ADULTERADO';
  isTampered: boolean;
  totalBids: number;
  verifiedAt: string;
  genesisHash: string | null;
  headHash: string | null;
  violation: AuditViolation | null;
  chain: AuditChainNode[];
  techniqueExplanation: string;
}
