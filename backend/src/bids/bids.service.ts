import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LotStatus, Prisma } from '@prisma/client';
import { toLotView } from '../lots/lots.types';
import { PrismaService } from '../prisma/prisma.service';
import { BidsGateway } from './bids.gateway';
import {
  BidView,
  computeBidHash,
  getBidderPseudonym,
  LiveRoomState,
  PlaceBidResponse,
  UserAuctionStatus,
} from './bids.types';
import { PlaceBidDto } from './dto/place-bid.dto';

const TWO_MINUTES_MS = 2 * 60 * 1000;

function formatCurrency(cents: number | bigint): string {
  return (Number(cents) / 100).toFixed(2).replace('.', ',');
}

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: BidsGateway,
  ) {}

  /**
   * Registra um novo lance em tempo real, aplicando atomicamente todas as regras de negocio:
   * 1. Apenas lotes ao vivo (startsAt <= agora < endsAt e status ACTIVE)
   * 2. 1o lance >= lance inicial; subsequentes >= lance atual + incremento minimo
   * 3. Licitante lider nao pode cobrir o proprio lance
   * 4. Licitante deve ter saldo disponivel suficiente na carteira
   * 5. Anti-sniping: estende o fim em +2 minutos se recebido nos ultimos 2 minutos
   * 6. Cadeia de hashes SHA-256 a prova de adulteracao (tamper-proof)
   * 7. Concorrencia serializada via transacao e row-lock no PostgreSQL
   * 8. Notificacao imediata via WebSockets para a sala e vitrine
   */
  async placeBid(
    bidderId: string,
    lotId: string,
    dto: PlaceBidDto,
    ipAddress?: string,
  ): Promise<PlaceBidResponse> {
    const bidAmount = BigInt(dto.amountCents);

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Bloqueio pessimista no registro do lote para evitar concorrencia
        await tx.$executeRaw`SELECT id FROM lots WHERE id = ${lotId}::uuid FOR UPDATE;`;

        const lot = await tx.lot.findUnique({
          where: { id: lotId },
          include: { _count: { select: { bids: true } } },
        });

        if (!lot) {
          throw new NotFoundException('Lote não encontrado');
        }

        if (lot.status === LotStatus.CANCELLED) {
          throw new BadRequestException('Este lote foi cancelado');
        }

        const now = new Date();

        if (now < lot.startsAt) {
          throw new BadRequestException(
            `Este lote ainda não foi iniciado (início em ${lot.startsAt.toISOString()})`,
          );
        }

        if (now >= lot.endsAt || lot.status === LotStatus.FINISHED) {
          throw new BadRequestException('Este lote já está encerrado');
        }

        if (lot.auctioneerId === bidderId) {
          throw new ForbiddenException('O leiloeiro não pode dar lances no próprio lote');
        }

        if (lot.winningBidderId === bidderId) {
          throw new BadRequestException('Você já é o licitante líder deste lote');
        }

        // Validacao do valor do lance
        const isFirstBid = lot._count.bids === 0 || lot.winningBidderId === null;
        if (isFirstBid) {
          if (bidAmount < lot.startPriceCents) {
            throw new BadRequestException(
              `O primeiro lance deve ser de no mínimo R$ ${formatCurrency(lot.startPriceCents)}`,
            );
          }
        } else {
          const minAcceptable = lot.currentPriceCents + lot.minIncrementCents;
          if (bidAmount < minAcceptable) {
            throw new BadRequestException(
              `O lance deve ser de no mínimo R$ ${formatCurrency(minAcceptable)} (lance atual de R$ ${formatCurrency(
                lot.currentPriceCents,
              )} + incremento de R$ ${formatCurrency(lot.minIncrementCents)})`,
            );
          }
        }

        // Verificacao do saldo disponivel do licitante
        const wallet = await tx.wallet.findUnique({ where: { userId: bidderId } });
        if (!wallet) {
          throw new BadRequestException('Carteira não encontrada para este usuário');
        }

        const otherLedLots = await tx.lot.findMany({
          where: {
            winningBidderId: bidderId,
            status: LotStatus.ACTIVE,
            startsAt: { lte: now },
            endsAt: { gt: now },
            id: { not: lotId },
          },
          select: { currentPriceCents: true },
        });

        const committedBalance = otherLedLots.reduce(
          (acc, l) => acc + l.currentPriceCents,
          BigInt(0),
        );
        const availableBalance = wallet.balanceCents - committedBalance;

        if (bidAmount > availableBalance) {
          throw new BadRequestException(
            `Saldo disponível insuficiente para cobrir este lance (disponível: R$ ${formatCurrency(
              availableBalance,
            )}, lance: R$ ${formatCurrency(bidAmount)})`,
          );
        }

        // Regra de anti-sniping: lance nos ultimos 2 minutos estende o fim para +2 minutos
        const remainingMs = lot.endsAt.getTime() - now.getTime();
        let newEndsAt = lot.endsAt;
        let wasExtended = false;

        if (remainingMs <= TWO_MINUTES_MS) {
          newEndsAt = new Date(now.getTime() + TWO_MINUTES_MS);
          wasExtended = true;
        }

        // Cadeia criptografica de hashes (hash chain)
        const previousBid = await tx.bid.findFirst({
          where: { lotId },
          orderBy: { createdAt: 'desc' },
        });

        const prevHash = previousBid?.hash ?? null;
        const prevBidId = previousBid?.id ?? null;
        const bidDate = new Date();
        const hash = computeBidHash(prevHash, lotId, bidderId, bidAmount, bidDate);

        const createdBid = await tx.bid.create({
          data: {
            lotId,
            bidderId,
            amountCents: bidAmount,
            previousBidId: prevBidId,
            previousHash: prevHash,
            hash,
            ipAddress,
            createdAt: bidDate,
          },
        });

        const updatedLot = await tx.lot.update({
          where: { id: lotId },
          data: {
            currentPriceCents: bidAmount,
            winningBidderId: bidderId,
            endsAt: newEndsAt,
            status: LotStatus.ACTIVE,
          },
          include: { _count: { select: { bids: true } } },
        });

        return { createdBid, updatedLot, wasExtended, bidDate };
      },
      { timeout: 10000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    const pseudonym = getBidderPseudonym(bidderId, lotId);

    const bidView: BidView = {
      id: result.createdBid.id,
      lotId: result.createdBid.lotId,
      amountCents: Number(result.createdBid.amountCents),
      bidderPseudonym: pseudonym,
      isMine: true,
      createdAt: result.createdBid.createdAt.toISOString(),
      hash: result.createdBid.hash,
    };

    // Notificacao em tempo real para todos os clientes conectados
    this.gateway.broadcastNewBid(lotId, {
      bid: {
        ...bidView,
        isMine: false, // quem recebe pelo websocket avalia isMine pelo seu id
      },
      leaderId: bidderId,
      leaderPseudonym: pseudonym,
      currentPriceCents: Number(result.updatedLot.currentPriceCents),
      endsAt: result.updatedLot.endsAt.toISOString(),
      wasExtended: result.wasExtended,
      bidsCount: result.updatedLot._count.bids,
    });

    this.gateway.broadcastLotUpdated({
      lotId,
      currentPriceCents: Number(result.updatedLot.currentPriceCents),
      endsAt: result.updatedLot.endsAt.toISOString(),
      wasExtended: result.wasExtended,
      bidsCount: result.updatedLot._count.bids,
    });

    return {
      bid: bidView,
      lotId,
      currentPriceCents: Number(result.updatedLot.currentPriceCents),
      endsAt: result.updatedLot.endsAt.toISOString(),
      wasExtended: result.wasExtended,
      isWinning: true,
    };
  }

  /**
   * Retorna o historico auditavel de lances de um lote com dados anonimizados.
   */
  async getLotBids(lotId: string, currentUserId?: string): Promise<BidView[]> {
    const bids = await this.prisma.bid.findMany({
      where: { lotId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return bids.map((b) => ({
      id: b.id,
      lotId: b.lotId,
      amountCents: Number(b.amountCents),
      bidderPseudonym: getBidderPseudonym(b.bidderId, lotId),
      isMine: Boolean(currentUserId && b.bidderId === currentUserId),
      createdAt: b.createdAt.toISOString(),
      hash: b.hash,
    }));
  }

  /**
   * Retorna o estado completo da sala ao vivo de um lote.
   */
  async getLiveRoomState(lotId: string, currentUserId?: string): Promise<LiveRoomState> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { _count: { select: { bids: true } } },
    });

    if (!lot) {
      throw new NotFoundException('Lote não encontrado');
    }

    const bids = await this.getLotBids(lotId, currentUserId);
    const now = new Date();
    const lotView = toLotView(lot, now);

    let userStatus: UserAuctionStatus = 'NOT_APPLICABLE';

    if (currentUserId && currentUserId !== lot.auctioneerId) {
      if (lot.winningBidderId === currentUserId) {
        userStatus = 'WINNING';
      } else {
        const hasBids = bids.some((b) => b.isMine);
        userStatus = hasBids ? 'OUTBID' : 'NOT_BIDDING';
      }
    }

    const isFirstBid = lot._count.bids === 0 || lot.winningBidderId === null;
    const minNextBidCents = isFirstBid
      ? Number(lot.startPriceCents)
      : Number(lot.currentPriceCents + lot.minIncrementCents);

    const leaderPseudonym = lot.winningBidderId
      ? getBidderPseudonym(lot.winningBidderId, lotId)
      : null;

    return {
      lot: lotView,
      bids,
      currentLeaderPseudonym: leaderPseudonym,
      userStatus,
      timeRemainingSeconds: lotView.timeRemainingSeconds ?? 0,
      minNextBidCents,
    };
  }
}
