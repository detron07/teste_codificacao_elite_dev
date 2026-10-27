import { Injectable, Logger } from '@nestjs/common';
import { FALLBACK_ARTWORKS } from './artworks.catalog';
import { Artwork } from './artworks.types';

interface ClevelandCreator {
  description?: string;
  role?: string;
}

interface ClevelandArtwork {
  id: number;
  title: string;
  creation_date?: string;
  technique?: string;
  culture?: string[];
  department?: string;
  creators?: ClevelandCreator[];
  images?: {
    web?: { url?: string };
    print?: { url?: string };
    full?: { url?: string };
  };
}

interface ClevelandSearchResponse {
  data: ClevelandArtwork[];
  info: { total: number };
}

interface ClevelandDetailsResponse {
  data: ClevelandArtwork;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const API_TIMEOUT_MS = 4000; // 4 segundos

@Injectable()
export class ArtworksService {
  private readonly logger = new Logger(ArtworksService.name);
  private readonly cache = new Map<string, { timestamp: number; data: Artwork[] }>();
  private readonly itemCache = new Map<string, { timestamp: number; data: Artwork }>();

  /**
   * Busca obras de arte na API pública externa (Cleveland Museum of Art).
   * Se a API falhar, demorar mais de 4s ou sofrer rate limit, recorre
   * de forma transparente ao catálogo de fallback, garantindo 100% de disponibilidade.
   */
  async search(query = '', limit = 10): Promise<Artwork[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `search:${normalizedQuery}:${limit}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const url = `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(
        normalizedQuery || 'art',
      )}&limit=${limit}&has_image=1`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API externa respondeu com status ${response.status}`);
      }

      const json = (await response.json()) as ClevelandSearchResponse;
      const artworks = (json.data || [])
        .filter((item) => item.images?.web?.url || item.images?.full?.url)
        .map((item) => this.mapClevelandArtwork(item));

      if (artworks.length > 0) {
        this.cache.set(cacheKey, { timestamp: Date.now(), data: artworks });
        return artworks;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falha ao consultar API externa do Cleveland Museum (${message}). Ativando fallback resiliente.`,
      );
    }

    // Fallback: filtra catálogo interno
    const fallbackResults = this.searchFallbackCatalog(normalizedQuery, limit);
    return fallbackResults;
  }

  /**
   * Obtém detalhes de uma obra pelo identificador externo.
   */
  async findById(id: string): Promise<Artwork | null> {
    const cacheKey = `id:${id}`;
    const cached = this.itemCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // Verifica primeiro se é um item do catálogo de fallback
    const fallbackItem = FALLBACK_ARTWORKS.find((item) => item.id === id);
    if (fallbackItem) {
      return fallbackItem;
    }

    try {
      const url = `https://openaccess-api.clevelandart.org/api/artworks/${encodeURIComponent(id)}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const json = (await response.json()) as ClevelandDetailsResponse;
        if (json.data) {
          const artwork = this.mapClevelandArtwork(json.data);
          this.itemCache.set(cacheKey, { timestamp: Date.now(), data: artwork });
          return artwork;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao buscar obra por id ${id} na API externa: ${message}`);
    }

    // Se falhou e tem id numérico, tenta buscar fallback aproximado ou null
    return null;
  }

  private mapClevelandArtwork(item: ClevelandArtwork): Artwork {
    const primaryCreator = item.creators?.[0]?.description || 'Artista Desconhecido';
    const culture = Array.isArray(item.culture) ? item.culture.join(', ') : undefined;
    const imageUrl =
      item.images?.web?.url ||
      item.images?.full?.url ||
      item.images?.print?.url ||
      'https://openaccess-cdn.clevelandart.org/1958.39/1958.39_web.jpg';

    return {
      id: String(item.id),
      title: item.title || 'Sem título',
      artist: primaryCreator,
      date: item.creation_date || 'Data desconhecida',
      technique: item.technique || 'Técnica não especificada',
      culture,
      department: item.department,
      imageUrl,
      source: 'cleveland_museum',
    };
  }

  private searchFallbackCatalog(query: string, limit: number): Artwork[] {
    if (!query) {
      return FALLBACK_ARTWORKS.slice(0, limit);
    }

    const matches = FALLBACK_ARTWORKS.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.artist.toLowerCase().includes(query) ||
        a.technique.toLowerCase().includes(query) ||
        (a.culture && a.culture.toLowerCase().includes(query)),
    );

    return (matches.length > 0 ? matches : FALLBACK_ARTWORKS).slice(0, limit);
  }
}
