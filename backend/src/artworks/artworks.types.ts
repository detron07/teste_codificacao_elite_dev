/**
 * Representacao unificada de uma obra de arte vinda da API externa ou do catalogo de fallback.
 */
export interface Artwork {
  id: string;
  title: string;
  artist: string;
  date: string;
  technique: string;
  culture?: string;
  department?: string;
  dimensions?: string;
  imageUrl: string;
  source: 'cleveland_museum' | 'fallback_catalog';
}

/**
 * Atributos que sao persistidos no snapshot do lote no banco de dados.
 */
export interface ArtworkSnapshotAttributes {
  artist: string;
  date: string;
  technique: string;
  culture?: string;
  department?: string;
  dimensions?: string;
  source: string;
}
