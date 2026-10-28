import { Injectable, NotFoundException } from '@nestjs/common';
import { computeBidHash, getBidderPseudonym } from '../bids/bids.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditChainNode, AuditViolation, LotAuditResult } from './audit.types';

const TECHNIQUE_EXPLANATION =
  'Auditoria baseada em encadeamento criptografico unidirecional (Cryptographic Hash Chain / Merkle Chaining). ' +
  'Cada lance registra o hash SHA-256 do lance imediatamente anterior e calcula seu proprio hash como ' +
  'SHA256(previousHash + ":" + lotId + ":" + bidderId + ":" + amountCents + ":" + createdAt). ' +
  'Se qualquer registro for alterado, removido ou inserido diretamente no banco de dados, o hash recalculado ' +
  'divergira do hash gravado ou o elo com o lance posterior sera quebrado, permitindo a deteccao imediata da adulteracao. ' +
  'A privacidade dos licitantes e preservada pela geracao de pseudonimos determinísticos baseados em HMAC por lote.';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Realiza a verificacao criptografica de integridade de todos os lances de um lote.
   * Rota publica acessivel sem login.
   */
  async auditLot(lotId: string): Promise<LotAuditResult> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        bids: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!lot) {
      throw new NotFoundException(`Lote com ID ${lotId} não encontrado`);
    }

    const bids = lot.bids;
    const verifiedAt = new Date().toISOString();

    if (bids.length === 0) {
      return {
        lotId: lot.id,
        lotTitle: lot.title,
        status: 'INTEGRO',
        isTampered: false,
        totalBids: 0,
        verifiedAt,
        genesisHash: null,
        headHash: null,
        violation: null,
        chain: [],
        techniqueExplanation: TECHNIQUE_EXPLANATION,
      };
    }

    const chain: AuditChainNode[] = [];
    let violation: AuditViolation | null = null;
    let expectedPreviousHash: string | null = null;

    for (let i = 0; i < bids.length; i++) {
      const bid = bids[i];
      const sequenceIndex = i + 1;
      const expectedHash = computeBidHash(
        expectedPreviousHash,
        lot.id,
        bid.bidderId,
        bid.amountCents,
        bid.createdAt,
      );

      let isValid = true;
      let reason = '';

      // 1. Verificacao do elo anterior na cadeia
      if (bid.previousHash !== expectedPreviousHash) {
        isValid = false;
        reason = `Elo quebrado: previousHash gravado ('${bid.previousHash ?? 'null'}') difere do hash do lance anterior ('${expectedPreviousHash ?? 'null'}')`;
      }
      // 2. Verificacao do conteudo do proprio lance (hash recalculado vs gravado)
      else if (bid.hash !== expectedHash) {
        isValid = false;
        reason = `Assinatura de conteudo violada: o hash gravado no banco nao confere com os dados do lance (possivel alteracao de valor, data ou autor)`;
      }
      // 3. Verificacao de progressao de valor (o lance atual deve ser superior ao anterior)
      else if (i > 0 && bid.amountCents <= bids[i - 1].amountCents) {
        isValid = false;
        reason = `Inconsistencia financeira: o lance ${sequenceIndex} (R$ ${(Number(bid.amountCents) / 100).toFixed(2)}) e menor ou igual ao lance anterior (R$ ${(Number(bids[i - 1].amountCents) / 100).toFixed(2)})`;
      }

      chain.push({
        sequenceIndex,
        bidId: bid.id,
        bidderPseudonym: getBidderPseudonym(bid.bidderId, lot.id),
        amountCents: Number(bid.amountCents),
        createdAt: bid.createdAt.toISOString(),
        previousHash: bid.previousHash,
        hash: bid.hash,
        isValid,
      });

      if (!isValid && !violation) {
        violation = {
          bidId: bid.id,
          sequenceIndex,
          reason,
          expectedHash,
          actualHash: bid.hash,
        };
      }

      // Proximo lance deve apontar para o hash deste lance
      expectedPreviousHash = bid.hash;
    }

    const isTampered = violation !== null;

    return {
      lotId: lot.id,
      lotTitle: lot.title,
      status: isTampered ? 'ADULTERADO' : 'INTEGRO',
      isTampered,
      totalBids: bids.length,
      verifiedAt,
      genesisHash: bids[0].hash,
      headHash: bids[bids.length - 1].hash,
      violation,
      chain,
      techniqueExplanation: TECHNIQUE_EXPLANATION,
    };
  }
}
