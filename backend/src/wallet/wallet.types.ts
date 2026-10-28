import { WalletTransactionType } from '@prisma/client';

export interface WalletTransactionView {
  id: string;
  type: WalletTransactionType;
  amountCents: number;
  balanceAfterCents: number;
  description: string | null;
  createdAt: string;
}

export interface WalletSummary {
  totalBalanceCents: number;
  committedBalanceCents: number;
  availableBalanceCents: number;
  activeLeadsCount: number;
  recentTransactions: WalletTransactionView[];
}
