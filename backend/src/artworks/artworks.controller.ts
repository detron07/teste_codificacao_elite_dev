import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ArtworksService } from './artworks.service';
import { Artwork } from './artworks.types';

@Controller('artworks')
export class ArtworksController {
  constructor(private readonly artworksService: ArtworksService) {}

  /**
   * Busca obras de arte para que o leiloeiro selecione e monte um lote.
   */
  @Roles(Role.AUCTIONEER)
  @Get('search')
  async search(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
  ): Promise<{ items: Artwork[]; total: number }> {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30) : 10;
    const items = await this.artworksService.search(query || '', parsedLimit);
    return { items, total: items.length };
  }

  /**
   * Obtém detalhes de uma obra de arte específica.
   */
  @Roles(Role.AUCTIONEER)
  @Get(':id')
  async getById(@Param('id') id: string): Promise<Artwork> {
    const artwork = await this.artworksService.findById(id);
    if (!artwork) {
      throw new NotFoundException(`Obra de arte com ID ${id} não encontrada`);
    }
    return artwork;
  }
}
