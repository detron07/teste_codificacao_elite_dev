import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LotStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CancelLotDto } from './dto/cancel-lot.dto';
import { CreateLotDto } from './dto/create-lot.dto';
import { AuctioneerDashboardMetrics, LotView, ShowcaseResponse, toLotView } from './lots.types';

@Injectable()
export class LotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria um novo lote a partir de uma obra de arte.
   * O snapshot completo dos dados da obra e persistido localmente.
   */
  async create(auctioneerId: string, dto: CreateLotDto): Promise<LotView> {
    const now = new Date();
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : now;
    const endsAt = new Date(dto.endsAt);

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('A data de término deve ser posterior à data de início');
    }

    if (endsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('A data de término deve ser no futuro');
    }

    const initialStatus = startsAt > now ? LotStatus.SCHEDULED : LotStatus.ACTIVE;

    const lot = await this.prisma.lot.create({
      data: {
        auctioneerId,
        title: dto.title,
        description: dto.description,
        externalItemId: dto.externalItemId,
        imageUrl: dto.imageUrl,
        itemAttributes: dto.itemAttributes as Prisma.InputJsonValue,
        startPriceCents: BigInt(dto.startPriceCents),
        minIncrementCents: BigInt(dto.minIncrementCents),
        currentPriceCents: BigInt(dto.startPriceCents),
        startsAt,
        endsAt,
        originalEndsAt: endsAt,
        status: initialStatus,
      },
      include: {
        _count: { select: { bids: true } },
      },
    });

    return toLotView(lot, now);
  }

  /**
   * Retorna os lotes da vitrine publica separados em:
   * - Ao vivo (live)
   * - Agendados (scheduled)
   * - Encerrados (finished)
   * Lotes cancelados NUNCA aparecem na vitrine.
   */
  async getShowcase(): Promise<ShowcaseResponse> {
    const now = new Date();

    const lots = await this.prisma.lot.findMany({
      where: {
        status: { not: LotStatus.CANCELLED },
      },
      include: {
        _count: { select: { bids: true } },
      },
      orderBy: { endsAt: 'asc' },
    });

    const live: LotView[] = [];
    const scheduled: LotView[] = [];
    const finished: LotView[] = [];

    for (const lot of lots) {
      const view = toLotView(lot, now);
      if (view.status === LotStatus.ACTIVE) {
        live.push(view);
      } else if (view.status === LotStatus.SCHEDULED) {
        scheduled.push(view);
      } else if (view.status === LotStatus.FINISHED) {
        finished.push(view);
      }
    }

    // Ordenacoes apropriadas para a experiencia do usuario
    live.sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
    scheduled.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    finished.sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime());

    return { live, scheduled, finished };
  }

  /**
   * Obtem detalhes de um lote por ID.
   */
  async findById(id: string): Promise<LotView> {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: {
        _count: { select: { bids: true } },
      },
    });

    if (!lot) {
      throw new NotFoundException(`Lote com ID ${id} não encontrado`);
    }

    return toLotView(lot);
  }

  /**
   * Cancela um lote. Regra fundamental de negocio:
   * "cancelar um lote que ainda nao recebeu lances".
   * Se houver pelo menos 1 lance, a operacao e estritamente recusada.
   */
  async cancel(lotId: string, auctioneerId: string, dto?: CancelLotDto): Promise<LotView> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        _count: { select: { bids: true } },
      },
    });

    if (!lot) {
      throw new NotFoundException(`Lote com ID ${lotId} não encontrado`);
    }

    if (lot.auctioneerId !== auctioneerId) {
      throw new ForbiddenException('Apenas o leiloeiro proprietário pode cancelar este lote');
    }

    if (lot.status === LotStatus.CANCELLED) {
      throw new BadRequestException('Este lote já está cancelado');
    }

    if (lot._count.bids > 0) {
      throw new BadRequestException('Não é possível cancelar um lote que já recebeu lances');
    }

    const updated = await this.prisma.lot.update({
      where: { id: lotId },
      data: {
        status: LotStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: dto?.reason || 'Cancelado pelo leiloeiro',
      },
      include: {
        _count: { select: { bids: true } },
      },
    });

    return toLotView(updated);
  }

  /**
   * Retorna os lotes e metricas do painel do leiloeiro autenticado:
   * - Total de lotes criados
   * - Lotes ativos, agendados, encerrados e cancelados
   * - Total arrecadado dos lotes finalizados com lances
   */
  async getAuctioneerDashboard(auctioneerId: string): Promise<AuctioneerDashboardMetrics> {
    const now = new Date();

    const lots = await this.prisma.lot.findMany({
      where: { auctioneerId },
      include: {
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let activeLots = 0;
    let scheduledLots = 0;
    let finishedLots = 0;
    let cancelledLots = 0;
    let totalFinishedWithBids = 0;
    let totalRevenueCents = 0;

    const views: LotView[] = [];

    for (const lot of lots) {
      const view = toLotView(lot, now);
      views.push(view);

      if (view.status === LotStatus.ACTIVE) {
        activeLots++;
      } else if (view.status === LotStatus.SCHEDULED) {
        scheduledLots++;
      } else if (view.status === LotStatus.CANCELLED) {
        cancelledLots++;
      } else if (view.status === LotStatus.FINISHED) {
        finishedLots++;
        if ((view.bidsCount ?? 0) > 0) {
          totalFinishedWithBids++;
          totalRevenueCents += view.currentPriceCents;
        }
      }
    }

    return {
      totalLots: lots.length,
      activeLots,
      scheduledLots,
      finishedLots,
      cancelledLots,
      totalFinishedWithBids,
      totalRevenueCents,
      lots: views,
    };
  }
}
