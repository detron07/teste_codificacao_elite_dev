import React, { useEffect, useState } from 'react';
import {
  Clock,
  Eye,
  Gavel,
  ShieldCheck,
  Award,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { getSocket, joinShowcaseRoom } from '../services/socket';
import type { LotView, ShowcaseResponse } from '../types';
import { formatCountdown, formatCurrency, formatDateTime } from '../utils/format';

interface ShowcaseViewProps {
  onEnterLot: (lotId: string) => void;
  onOpenAudit: (lotId: string) => void;
  onOpenReceipt: (lotId: string) => void;
}

export const ShowcaseView: React.FC<ShowcaseViewProps> = ({
  onEnterLot,
  onOpenAudit,
  onOpenReceipt,
}) => {
  const [showcase, setShowcase] = useState<ShowcaseResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'scheduled' | 'finished'>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShowcase = async () => {
    try {
      setError(null);
      const data = await api.getShowcase();
      setShowcase(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a vitrine de lotes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchShowcase();

    // Conecta a sala showcase para receber atualizacoes de precos em tempo real
    joinShowcaseRoom();
    const socket = getSocket();

    const handleLotUpdated = (data: { lotId: string; currentPriceCents: number; endsAt: string; bidsCount: number }) => {
      setShowcase((prev) => {
        if (!prev) return prev;
        const updateList = (list: LotView[]) =>
          list.map((lot) =>
            lot.id === data.lotId
              ? {
                  ...lot,
                  currentPriceCents: data.currentPriceCents,
                  endsAt: data.endsAt,
                  bidsCount: data.bidsCount,
                }
              : lot,
          );
        return {
          ...prev,
          live: updateList(prev.live),
          scheduled: updateList(prev.scheduled),
          finished: updateList(prev.finished),
        };
      });
    };

    const handleLotSettled = () => {
      // Quando um lote e liquidado, recarrega a vitrine para mover entre abas
      void fetchShowcase();
    };

    socket.on('lot:updated', handleLotUpdated);
    socket.on('lot:settled', handleLotSettled);

    return () => {
      socket.off('lot:updated', handleLotUpdated);
      socket.off('lot:settled', handleLotSettled);
    };
  }, []);

  const liveLots = showcase?.live || [];
  const scheduledLots = showcase?.scheduled || [];
  const finishedLots = showcase?.finished || [];

  const currentList =
    activeTab === 'live'
      ? liveLots
      : activeTab === 'scheduled'
        ? scheduledLots
        : finishedLots;

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%' }}>
      {/* Hero Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(26, 29, 46, 0.95), rgba(16, 18, 30, 0.95))',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem 2.5rem',
          marginBottom: '2.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '280px',
            height: '280px',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ maxWidth: '820px', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: 'var(--gold-400)',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            <Sparkles size={14} />
            <span>Coleções Raras & Obras de Museu</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 3rem)',
              fontFamily: 'var(--font-serif)',
              lineHeight: 1.15,
              marginBottom: '1rem',
              color: '#ffffff',
            }}
          >
            Leilões de Arte com <span style={{ color: 'var(--gold-400)', fontStyle: 'italic' }}>Transparência Criptográfica</span>
          </h1>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.05rem',
              lineHeight: 1.6,
              marginBottom: '1.75rem',
            }}
          >
            Dispute obras originais catalogadas pelo Cleveland Museum of Art em tempo real.
            Cadeia de hashes imutável SHA-256 para cada lance, proteção de saldo comprometido,
            anti-sniping automático e emissão pública de comprovantes de arremate.
          </p>

          <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="var(--audit-blue)" />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Auditoria de Hash Chain
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="var(--live-green)" />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Regra Anti-Sniping (+2 min)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={20} color="var(--gold-400)" />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Comprovante Público com Selo
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.75rem',
          borderBottom: '1px solid var(--bg-glass-border)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setActiveTab('live')}
            className={`btn ${activeTab === 'live' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '0.5rem 1.25rem' }}
          >
            <div className="pulse-dot" />
            <span>Ao Vivo Agora</span>
            <span
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '0.1rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
              }}
            >
              {liveLots.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('scheduled')}
            className={`btn ${activeTab === 'scheduled' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '0.5rem 1.25rem' }}
          >
            <Calendar size={15} />
            <span>Agendados</span>
            <span
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '0.1rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
              }}
            >
              {scheduledLots.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('finished')}
            className={`btn ${activeTab === 'finished' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '0.5rem 1.25rem' }}
          >
            <CheckCircle2 size={15} />
            <span>Encerrados</span>
            <span
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '0.1rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
              }}
            >
              {finishedLots.length}
            </span>
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Mostrando {currentList.length} lote{currentList.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Carregando catálogo de obras da Casa Aurora...
        </div>
      )}

      {/* Empty state */}
      {!loading && currentList.length === 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <Gavel size={40} color="var(--gold-500)" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Nenhum lote nesta categoria</h3>
          <p style={{ fontSize: '0.925rem', color: 'var(--text-muted)' }}>
            Navegue pelas outras abas ou aguarde novos lançamentos do leiloeiro.
          </p>
        </div>
      )}

      {/* Lots Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.75rem',
        }}
      >
        {currentList.map((lot) => {
          const artist = (lot.itemAttributes as Record<string, string>)?.artist || 'Artista Renomado';
          const isLive = lot.status === 'ACTIVE';
          const isScheduled = lot.status === 'SCHEDULED';
          const isFinished = lot.status === 'FINISHED';

          return (
            <div
              key={lot.id}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              {/* Artwork Image Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '68%',
                  backgroundColor: '#050608',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={lot.imageUrl}
                  alt={lot.title}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform var(--transition-smooth)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />

                {/* Badge Overlay */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
                  {isLive && (
                    <span className="badge badge-live">
                      <span className="pulse-dot" />
                      Ao Vivo
                    </span>
                  )}
                  {isScheduled && (
                    <span className="badge badge-scheduled">
                      <Calendar size={12} />
                      Agendado
                    </span>
                  )}
                  {isFinished && (
                    <span className="badge badge-finished">
                      <CheckCircle2 size={12} />
                      Encerrado
                    </span>
                  )}
                </div>

                {/* Bids Count Pill */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(10, 11, 17, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--bg-glass-border)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  {lot.bidsCount} lance{lot.bidsCount === 1 ? '' : 's'}
                </div>
              </div>

              {/* Lot Info Body */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--gold-400)',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    marginBottom: '0.35rem',
                  }}
                >
                  {artist}
                </div>

                <h3
                  style={{
                    fontSize: '1.25rem',
                    fontFamily: 'var(--font-serif)',
                    lineHeight: 1.3,
                    marginBottom: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {lot.title}
                </h3>

                {lot.description && (
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                      marginBottom: '1rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {lot.description}
                  </p>
                )}

                {/* Pricing & Timing Box */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--bg-glass-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 0.95rem',
                    marginTop: 'auto',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {isFinished ? 'Valor de Arremate' : isLive ? 'Lance Atual' : 'Lance Inicial'}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: '1.35rem',
                          fontWeight: 700,
                          color: isFinished ? 'var(--text-primary)' : 'var(--gold-400)',
                        }}
                      >
                        {formatCurrency(lot.currentPriceCents)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {isLive ? 'Tempo Restante' : isScheduled ? 'Início' : 'Encerrado em'}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: isLive ? 'var(--live-green)' : 'var(--text-secondary)',
                        }}
                      >
                        {isLive
                          ? formatCountdown(lot.timeRemainingSeconds ?? 0)
                          : isScheduled
                            ? formatDateTime(lot.startsAt)
                            : formatDateTime(lot.endsAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => onEnterLot(lot.id)}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem' }}
                  >
                    <Eye size={15} />
                    <span>{isLive ? 'Entrar no Leilão' : 'Ver Detalhes'}</span>
                  </button>

                  <button
                    onClick={() => onOpenAudit(lot.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.55rem', borderRadius: 'var(--radius-md)' }}
                    title="Auditoria criptográfica da hash chain"
                  >
                    <ShieldCheck size={16} color="var(--audit-blue)" />
                  </button>

                  {isFinished && (
                    <button
                      onClick={() => onOpenReceipt(lot.id)}
                      className="btn btn-secondary"
                      style={{ padding: '0.55rem', borderRadius: 'var(--radius-md)' }}
                      title="Ver comprovante público de arremate"
                    >
                      <Award size={16} color="var(--gold-400)" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
