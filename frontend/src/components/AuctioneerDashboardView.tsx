import React, { useEffect, useState } from 'react';
import {
  Gavel,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
  ShieldCheck,
  Award,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { ArtworkSearchResult, AuctioneerDashboardMetrics } from '../types';
import { formatCurrency, formatDateTime } from '../utils/format';

interface AuctioneerDashboardViewProps {
  onEnterLot: (lotId: string) => void;
  onOpenAudit: (lotId: string) => void;
  onOpenReceipt: (lotId: string) => void;
}

export const AuctioneerDashboardView: React.FC<AuctioneerDashboardViewProps> = ({
  onEnterLot,
  onOpenAudit,
  onOpenReceipt,
}) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AuctioneerDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Busca na API de Arte
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ArtworkSearchResult[]>([]);
  const [selectedArtwork, setSelectedArtwork] = useState<ArtworkSearchResult | null>(null);

  // Formulario de Criacao de Lote
  const [startPrice, setStartPrice] = useState<number>(5000); // R$ 5.000,00
  const [minIncrement, setMinIncrement] = useState<number>(200); // R$ 200,00
  const [durationHours, setDurationHours] = useState<number>(24);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Acoes em lotes
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setError(null);
      const data = await api.getMyAuctioneerLots();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar painel do leiloeiro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'AUCTIONEER') {
      void loadDashboard();
    }
  }, [user?.id, user?.role]);

  const handleSearchArtworks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setCreateError(null);
    try {
      const results = await api.searchArtworks(searchQuery);
      setSearchResults(results);
      if (results.length > 0) {
        setSelectedArtwork(results[0]);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Falha na busca de obras no museu');
    } finally {
      setSearching(false);
    }
  };

  const handleCreateLot = async () => {
    if (!selectedArtwork) return;
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    const now = new Date();
    const startsAt = now.toISOString();
    const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();

    try {
      await api.createLot({
        title: selectedArtwork.title,
        description: `${selectedArtwork.artist} • ${selectedArtwork.technique || 'Pintura'} (${selectedArtwork.date || 'Data desconhecida'})`,
        externalItemId: selectedArtwork.id,
        imageUrl: selectedArtwork.imageUrl,
        itemAttributes: {
          artist: selectedArtwork.artist,
          date: selectedArtwork.date,
          technique: selectedArtwork.technique,
          department: selectedArtwork.department,
          culture: selectedArtwork.culture,
          source: 'cleveland_museum',
        },
        startPriceCents: Math.round(startPrice * 100),
        minIncrementCents: Math.round(minIncrement * 100),
        startsAt,
        endsAt,
      });

      setCreateSuccess(`Lote "${selectedArtwork.title}" criado com sucesso!`);
      setSelectedArtwork(null);
      setSearchResults([]);
      setSearchQuery('');
      await loadDashboard();
      setTimeout(() => setCreateSuccess(null), 5000);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Falha ao criar lote');
    } finally {
      setCreating(false);
    }
  };

  const handleCancelLot = async (lotId: string) => {
    if (!window.confirm('Tem certeza de que deseja cancelar este lote?')) return;
    setCancellingId(lotId);
    setActionMessage(null);

    try {
      await api.cancelLot(lotId, 'Cancelado pelo leiloeiro no painel');
      setActionMessage('Lote cancelado com sucesso.');
      await loadDashboard();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar lote');
    } finally {
      setCancellingId(null);
    }
  };

  const handleSettleLot = async (lotId: string) => {
    setSettlingId(lotId);
    setActionMessage(null);

    try {
      const res = await api.settleLot(lotId);
      setActionMessage(
        res.hadWinner
          ? `Lote liquidado com sucesso! Comprovante nº ${res.receiptNumber} emitido.`
          : 'Lote encerrado sem lances.',
      );
      await loadDashboard();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao liquidar lote');
    } finally {
      setSettlingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Carregando métricas do leiloeiro e lotes gerenciados...
      </div>
    );
  }

  const lots = metrics?.lots || [];

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%' }}>
      {/* Header do Painel */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--gold-400), var(--gold-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-gold)',
            }}
          >
            <Gavel size={20} color="#0a0b11" />
          </div>
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-serif)' }}>Painel de Controle do Leiloeiro</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Gestão de lotes, integração com catálogo do museu, encerramento de leilões e métricas de arrecadação.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {actionMessage && (
        <div
          className="animate-fade-in"
          style={{
            padding: '1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#34d399',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Metricas de Arrecadacao */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Total de Lotes
          </div>
          <div className="mono" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {metrics?.totalLots || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cadastrados no catálogo</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#6ee7b7', textTransform: 'uppercase', fontWeight: 600 }}>
            Lotes ao Vivo
          </div>
          <div className="mono" style={{ fontSize: '2rem', fontWeight: 700, color: '#34d399', marginTop: '0.25rem' }}>
            {metrics?.activeLots || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recebendo lances agora</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#7dd3fc', textTransform: 'uppercase', fontWeight: 600 }}>
            Lotes Agendados
          </div>
          <div className="mono" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--audit-blue)', marginTop: '0.25rem' }}>
            {metrics?.scheduledLots || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aguardando início</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--gold-300)', textTransform: 'uppercase', fontWeight: 600 }}>
            Arrecadação Total
          </div>
          <div className="mono" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--gold-400)', marginTop: '0.25rem' }}>
            {formatCurrency(metrics?.totalRevenueCents || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Liquidado e creditado</div>
        </div>
      </div>

      {/* SECAO: CRIAR NOVO LOTE A PARTIR DA API DE ARTE */}
      <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <PlusCircle size={20} color="var(--gold-400)" />
          <h2 style={{ fontSize: '1.45rem' }}>Montar Novo Lote (API Cleveland Museum of Art)</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Pesquise uma obra no acervo do museu. Todos os metadados (título, artista, técnica, dimensões e imagem de alta
          resolução) serão persistidos atomicamente no lote para garantir resiliência total mesmo se o museu estiver fora do ar.
        </p>

        {/* Formulario de Busca */}
        <form onSubmit={handleSearchArtworks} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Digite o nome de uma obra ou artista (ex: Monet, Rembrandt, Van Gogh, Water Lilies)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" disabled={searching || !searchQuery.trim()} className="btn btn-primary" style={{ padding: '0.65rem 1.5rem' }}>
            <Search size={16} />
            <span>{searching ? 'Buscando...' : 'Buscar no Museu'}</span>
          </button>
        </form>

        {/* Resultados da Busca */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Selecione uma obra encontrada ({searchResults.length} opções):
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '1rem',
                maxHeight: '340px',
                overflowY: 'auto',
                padding: '0.5rem',
                background: 'rgba(10, 11, 17, 0.4)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {searchResults.map((item) => {
                const isSelected = selectedArtwork?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedArtwork(item)}
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? 'var(--gold-500)' : 'var(--bg-glass-border)'}`,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gold-400)', marginTop: '0.15rem' }}>
                        {item.artist}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {item.date} • {item.technique}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Configuracao do Lote Selecionado */}
        {selectedArtwork && (
          <div
            className="animate-fade-in"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <img
                src={selectedArtwork.imageUrl}
                alt={selectedArtwork.title}
                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
              />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gold-400)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Obra Selecionada
                </div>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', margin: '0.2rem 0' }}>
                  {selectedArtwork.title}
                </h3>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                  {selectedArtwork.artist} • {selectedArtwork.date}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>
                  Lance Inicial (R$)
                </label>
                <input
                  type="number"
                  className="form-input mono"
                  min="1"
                  step="50"
                  value={startPrice}
                  onChange={(e) => setStartPrice(Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>
                  Incremento Mínimo (R$)
                </label>
                <input
                  type="number"
                  className="form-input mono"
                  min="1"
                  step="10"
                  value={minIncrement}
                  onChange={(e) => setMinIncrement(Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>
                  Duração do Leilão
                </label>
                <select
                  className="form-input"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                >
                  <option value={1}>1 hora (teste rápido)</option>
                  <option value={6}>6 horas</option>
                  <option value={24}>24 horas (1 dia)</option>
                  <option value={72}>72 horas (3 dias)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateLot}
              disabled={creating || startPrice <= 0 || minIncrement <= 0}
              className="btn btn-primary"
              style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
            >
              <Sparkles size={17} />
              <span>{creating ? 'Registrando Lote...' : 'Publicar Lote no Leilão'}</span>
            </button>

            {createSuccess && (
              <div
                className="animate-fade-in"
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#34d399',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{createSuccess}</span>
              </div>
            )}

            {createError && (
              <div
                className="animate-fade-in"
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={16} />
                <span>{createError}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECAO: LOTES DO LEILOEIRO */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.45rem' }}>Lotes Cadastrados por Você ({lots.length})</h2>
        </div>

        {lots.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nenhum lote cadastrado ainda. Utilize o formulário acima para criar o seu primeiro leilão de arte!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {lots.map((lot) => {
              const isLive = lot.status === 'ACTIVE';
              const isScheduled = lot.status === 'SCHEDULED';
              const isFinished = lot.status === 'FINISHED';
              const canCancel = lot.bidsCount === 0 && !isFinished;

              return (
                <div
                  key={lot.id}
                  className="glass-panel"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    gap: '1.25rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '280px', flex: 1 }}>
                    <img
                      src={lot.imageUrl}
                      alt={lot.title}
                      style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        {isLive && <span className="badge badge-live">Ao Vivo</span>}
                        {isScheduled && <span className="badge badge-scheduled">Agendado</span>}
                        {isFinished && <span className="badge badge-finished">Encerrado</span>}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {lot.bidsCount} lance{lot.bidsCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', margin: '0.15rem 0' }}>
                        {lot.title}
                      </h4>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        Início: {formatDateTime(lot.startsAt)} • Fim: {formatDateTime(lot.endsAt)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {isFinished ? 'Valor Final' : 'Lance Atual'}
                      </div>
                      <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--gold-400)' }}>
                        {formatCurrency(lot.currentPriceCents)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => onEnterLot(lot.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                      >
                        <Eye size={15} />
                        <span>Abrir</span>
                      </button>

                      <button
                        onClick={() => onOpenAudit(lot.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.45rem', borderRadius: 'var(--radius-md)' }}
                        title="Auditar cadeia de lances"
                      >
                        <ShieldCheck size={16} color="var(--audit-blue)" />
                      </button>

                      {isFinished && (
                        <button
                          onClick={() => onOpenReceipt(lot.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem', borderRadius: 'var(--radius-md)' }}
                          title="Ver comprovante emitido"
                        >
                          <Award size={16} color="var(--gold-400)" />
                        </button>
                      )}

                      {/* Botao de Liquidacao Manual */}
                      {!isFinished && (
                        <button
                          onClick={() => handleSettleLot(lot.id)}
                          disabled={settlingId === lot.id}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', borderColor: 'var(--gold-500)' }}
                          title="Encerrar lote e liquidar carteiras"
                        >
                          <span>{settlingId === lot.id ? 'Liquidando...' : 'Liquidar Lote'}</span>
                        </button>
                      )}

                      {/* Botao de Cancelar Lote (permitido apenas com 0 lances) */}
                      {canCancel && (
                        <button
                          onClick={() => handleCancelLot(lot.id)}
                          disabled={cancellingId === lot.id}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', borderColor: 'var(--alert-red)', color: 'var(--alert-red)' }}
                          title="Cancelar lote (apenas se 0 lances)"
                        >
                          <Trash2 size={14} />
                          <span>{cancellingId === lot.id ? 'Cancelando...' : 'Cancelar'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
