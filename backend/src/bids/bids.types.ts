import { createHash, createHmac } from 'node:crypto';
import { LotView } from '../lots/lots.types';

export interface BidView {
  id: string;
  lotId: string;
  amountCents: number;
  bidderPseudonym: string;
  isMine: boolean;
  createdAt: string;
  hash: string;
}

export type UserAuctionStatus =
  | 'WINNING' // Licitante liderando o lote ("Voce esta ganhando")
  | 'OUTBID' // Licitante foi superado por outro lance ("Voce foi superado")
  | 'NOT_BIDDING' // Licitante ainda nao deu lances neste lote
  | 'NOT_APPLICABLE'; // Visitante sem login ou leiloeiro

export interface LiveRoomState {
  lot: LotView;
  bids: BidView[];
  currentLeaderPseudonym: string | null;
  userStatus: UserAuctionStatus;
  timeRemainingSeconds: number;
  minNextBidCents: number;
}

export interface PlaceBidResponse {
  bid: BidView;
  lotId: string;
  currentPriceCents: number;
  endsAt: string;
  wasExtended: boolean;
  isWinning: boolean;
}

/**
 * Gera um pseudonimo anonimizado e deterministico para o licitante dentro do lote,
 * cumprindo os requisitos de privacidade e LGPD (ex.: "Licitante #A3F9").
 * O mesmo usuario tera o mesmo pseudonimo no mesmo lote, mas nao em lotes distintos.
 */
export function getBidderPseudonym(bidderId: string, lotId: string): string {
  const secret = process.env.JWT_SECRET || 'salt-verzel-privacy-2026';
  const hmac = createHmac('sha256', secret).update(`${lotId}:${bidderId}`).digest('hex');
  return `Licitante #${hmac.slice(0, 4).toUpperCase()}`;
}

/**
 * Calcula o hash criptografico SHA-256 de um lance encadeado ao hash do lance anterior
 * (tamper-proof cryptographic hash chain).
 */
export function computeBidHash(
  prevHash: string | null,
  lotId: string,
  bidderId: string,
  amountCents: bigint,
  createdAt: Date,
): string {
  const payload = `${prevHash ?? 'GENESIS'}:${lotId}:${bidderId}:${amountCents.toString()}:${createdAt.toISOString()}`;
  return createHash('sha256').update(payload).digest('hex');
}
