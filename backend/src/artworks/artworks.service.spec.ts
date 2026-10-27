import { FALLBACK_ARTWORKS } from './artworks.catalog';
import { ArtworksService } from './artworks.service';

describe('ArtworksService', () => {
  let service: ArtworksService;

  beforeEach(() => {
    service = new ArtworksService();
    jest.restoreAllMocks();
  });

  it('retorna obras do catalogo de fallback caso a busca externa falhe', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const results = await service.search('Monet', 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('fallback_catalog');
  });

  it('retorna resultados cacheados na segunda chamada', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 99999,
              title: 'Obra Teste',
              creation_date: '2026',
              creators: [{ description: 'Artista Teste' }],
              images: { web: { url: 'https://cdn.example.com/art.jpg' } },
            },
          ],
          info: { total: 1 },
        }),
    } as unknown as Response);

    const first = await service.search('teste', 5);
    const second = await service.search('teste', 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first[0].title).toBe('Obra Teste');
  });

  it('encontra obra por ID do catalogo de fallback diretamente', async () => {
    const fallbackItem = FALLBACK_ARTWORKS[0];
    const found = await service.findById(fallbackItem.id);

    expect(found).not.toBeNull();
    expect(found?.title).toBe(fallbackItem.title);
  });
});
