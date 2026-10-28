import React, { useEffect, useState } from 'react';
import {
  Clock,
  ShieldCheck,
  Award,
  ArrowLeft,
  Gavel,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket, joinLotRoom, leaveLotRoom } from '../services/socket';
import type { BidView, LiveRoomState } from '../types';
import { formatCountdown, formatCurrency, formatDateTime, truncateHash } from '../utils/format';

interface LiveRoomViewProps {
  lotId: string;
  onBack: () => void;
  onOpenAudit: (lotId: string) => void;
  onOpenReceipt: (lotId: string) => void;
  onOpenWalletModal: () => void;
}

export const LiveRoomView: React.FC<LiveRoomViewProps> = ({
  lotId,
  onBack,
  onOpenAudit,
  onOpenReceipt,
  onOpenWalletModal,
}) => {
  const { user, wallet, isBidder, isAuctioneer, isAuthenticated, refreshWallet } = useAuth();
  const [state, setState] = useState<LiveRoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario de lance
  const [customAmountCents, setCustomAmountCents] = useState<number>(0);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccessMessage, setBidSuccessMessage] = useState<string | null>(null);
  const [antiSnipingAlert, setAntiSnipingAlert] = useState(false);

  // Contagem regressiva local em segundos
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const fetchRoomState = async () => {
    try {
      setError(null);
      const res = await api.getLiveRoomState(lotId);
      setState(res);
      setTimeRemaining(res.timeRemainingSeconds);
      setCustomAmountCents(res.minNextBidCents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a sala do lote');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRoomState();

    // Conecta a sala do lote no WebSocket
    joinLotRoom(lotId);
    const socket = getSocket();

    const handleNewBid = (data: {
      bid: BidView;
      leaderId: string;
      leaderPseudonym: string;
      currentPriceCents: number;
      endsAt: string;
      wasExtended: boolean;
      bidsCount: number;
    }) => {
      setState((prev) => {
        if (!prev) return prev;
        const isMine = Boolean(user && data.leaderId === user.id);
        const newBid: BidView = {
          ...data.bid,
          isMine,
        };

        const nextMin = data.currentPriceCents + prev.lot.minIncrementCents;
        setCustomAmountCents(nextMin);

        if (data.wasExtended) {
          setAntiSnipingAlert(true);
          setTimeout(() => setAntiSnipingAlert(false), 8000);
        }

        return {
          ...prev,
          lot: {
            ...prev.lot,
            currentPriceCents: data.currentPriceCents,
            endsAt: data.endsAt,
            bidsCount: data.bidsCount,
          },
          bids: [newBid, ...prev.bids],
          currentLeaderPseudonym: data.leaderPseudonym,
          userStatus: isMine ? 'WINNING' : prev.userStatus === 'WINNING' ? 'OUTBID' : prev.userStatus,
          minNextBidCents: nextMin,
        };
      });

      // Atualiza carteira do usuario (saldo comprometido muda se for lider ou superado)
      if (isBidder) {
        void refreshWallet();
      }
    };

    const handleLotSettled = () => {
      void fetchRoomState();
      if (isBidder) {
        void refreshWallet();
      }
    };

    socket.on('bid:new', handleNewBid);
    socket.on('lot:settled', handleLotSettled);

    return () => {
      leaveLotRoom(lotId);
      socket.off('bid:new', handleNewBid);
      socket.off('lot:settled', handleLotSettled);
    };
  }, [lotId, user, isBidder, refreshWallet]);

  // Timer regressivo de 1 segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePlaceBid = async (amountCentsToPlace: number) => {
    setBidError(null);
    setBidSuccessMessage(null);
    setSubmittingBid(true);

    try {
      const res = await api.placeBid(lotId, amountCentsToPlace);
      setBidSuccessMessage(`Lance de ${formatCurrency(amountCentsToPlace)} aceito com sucesso!`);
      setTimeout(() => setBidSuccessMessage(null), 5000);
      setCustomAmountCents(res.currentPriceCents + (state?.lot.minIncrementCents || 1000));
    } catch (err) {
      setBidError(err instanceof Error ? err.message : 'Falha ao submeter lance');
    } finally {
      setSubmittingBid(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Entrando na sala do leilão em tempo real...
      </div>
    );
  }

  if (error || !state) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--alert-red)', marginBottom: '1.5rem' }}>{error || 'Lote não encontrado'}</p>
        <button onClick={onBack} className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Voltar para a Vitrine</span>
        </button>
      </div>
    );
  }

  const { lot, bids, currentLeaderPseudonym, userStatus, minNextBidCents } = state;
  const isFinished = lot.status === 'FINISHED';
  const isScheduled = lot.status === 'SCHEDULED';
  const isLive = lot.status === 'ACTIVE' && timeRemaining > 0;
  const inAntiSnipingZone = isLive && timeRemaining <= 120;
  const artist = (lot.itemAttributes as Record<string, string>)?.artist || 'Artista Renomado';
  const attrs = lot.itemAttributes as Record<string, string>;

  // Saldo do licitante disponivel para lance
  const availableBalance = wallet?.availableBalanceCents || 0;
  const hasSufficientBalance = isBidder && availableBalance >= customAmountCents;

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '1.5rem', width: '100%' }}>
      {/* Top Bar: Voltar + Botoes de Acao */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '0.45rem 0.95rem' }}>
          <ArrowLeft size={16} />
          <span>Voltar à Vitrine</span>
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => onOpenAudit(lotId)}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.95rem', borderColor: 'var(--audit-blue)' }}
          >
            <ShieldCheck size={16} color="var(--audit-blue)" />
            <span>Auditar Hash Chain ({bids.length} nós)</span>
          </button>

          {isFinished && (
            <button
              onClick={() => onOpenReceipt(lotId)}
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.95rem' }}
            >
              <Award size={16} />
              <span>Ver Comprovante de Arremate</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta Anti-Sniping ao vivo */}
      {antiSnipingAlert && (
        <div
          className="animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.25))',
            border: '1px solid var(--gold-500)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--gold-300)',
          }}
        >
          <Zap size={20} color="var(--gold-400)" />
          <div>
            <strong>Regra Anti-Sniping Acionada!</strong>
            <span style={{ fontSize: '0.9rem', marginLeft: '0.5rem' }}>
              Um lance foi recebido nos últimos 2 minutos. O leilão foi prorrogado automaticamente em +2 minutos.
            </span>
          </div>
        </div>
      )}

      {/* Main Split Layout: Obra (Esq) vs Console de Lances (Dir) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '2rem',
          alignItems: 'start',
        }}
      >
        {/* COLUNA ESQUERDA: OBRA DE ARTE E METADADOS DE MUSEU */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          {/* Imagem com moldura elegante */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundColor: '#050608',
              boxShadow: 'var(--shadow-lg)',
              marginBottom: '1.5rem',
              border: '2px solid rgba(245, 158, 11, 0.2)',
            }}
          >
            <img
              src={lot.imageUrl}
              alt={lot.title}
              style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', display: 'block' }}
            />
          </div>

          <div
            style={{
              fontSize: '0.85rem',
              color: 'var(--gold-400)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '0.35rem',
            }}
          >
            {artist}
          </div>

          <h2
            style={{
              fontSize: '1.75rem',
              fontFamily: 'var(--font-serif)',
              lineHeight: 1.2,
              marginBottom: '1rem',
            }}
          >
            {lot.title}
          </h2>

          {lot.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {lot.description}
            </p>
          )}

          {/* Atributos do Museu (Snapshot) */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bg-glass-border)',
              padding: '1.25rem',
            }}
          >
            <h4
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '1rem',
              }}
            >
              Ficha Técnica do Acervo (Cleveland Museum of Art)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Datação:</span>{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{attrs?.date || 'Não informada'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Técnica:</span>{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{attrs?.technique || 'Pintura'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Cultura:</span>{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{attrs?.culture || 'Ocidental'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Dimensões:</span>{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{attrs?.dimensions || 'Variadas'}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>ID Externo:</span>{' '}
                <span className="mono" style={{ color: 'var(--audit-blue)', fontWeight: 500 }}>
                  {lot.externalItemId}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: PAINEL AO VIVO E CONSOLE DE LANCES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Cartao de Status de Lideranca e Temporizador */}
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              border: inAntiSnipingZone
                ? '1px solid var(--alert-red)'
                : '1px solid rgba(245, 158, 11, 0.3)',
              boxShadow: inAntiSnipingZone ? '0 0 20px rgba(239, 68, 68, 0.25)' : 'var(--shadow-md)',
            }}
          >
            {/* Header de Preco e Timer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1.25rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {isFinished ? 'Valor Final Arrematado' : 'Lance Atual'}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: isFinished ? 'var(--text-primary)' : 'var(--gold-400)',
                    lineHeight: 1.1,
                  }}
                >
                  {formatCurrency(lot.currentPriceCents)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Incremento mínimo:{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>{formatCurrency(lot.minIncrementCents)}</strong>
                </div>
              </div>

              {/* Temporizador */}
              <div
                style={{
                  textAlign: 'right',
                  background: inAntiSnipingZone ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${inAntiSnipingZone ? 'var(--alert-red)' : 'var(--bg-glass-border)'}`,
                }}
              >
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: inAntiSnipingZone ? '#fca5a5' : 'var(--text-muted)',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '0.35rem',
                  }}
                >
                  <Clock size={12} color={inAntiSnipingZone ? 'var(--alert-red)' : 'var(--live-green)'} />
                  <span>{isLive ? 'Tempo Restante' : isScheduled ? 'Início do Leilão' : 'Status'}</span>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 700,
                    color: inAntiSnipingZone ? 'var(--alert-red)' : isLive ? 'var(--live-green)' : 'var(--text-muted)',
                  }}
                >
                  {isLive ? formatCountdown(timeRemaining) : isScheduled ? formatDateTime(lot.startsAt) : 'Encerrado'}
                </div>
                {inAntiSnipingZone && (
                  <div style={{ fontSize: '0.675rem', color: '#fca5a5', fontWeight: 600 }}>
                    Zona Anti-Sniping (+2 min)
                  </div>
                )}
              </div>
            </div>

            {/* Banner Dinamico de Situacao do Licitante */}
            <div style={{ marginBottom: '1rem' }}>
              {userStatus === 'WINNING' && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    color: '#6ee7b7',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                  }}
                >
                  <Sparkles size={18} color="var(--live-green)" />
                  <span>
                    <strong>Você é o líder atual!</strong> Seu saldo de {formatCurrency(lot.currentPriceCents)} está
                    comprometido.
                  </span>
                </div>
              )}

              {userStatus === 'OUTBID' && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                  }}
                >
                  <AlertTriangle size={18} color="var(--alert-red)" />
                  <span>
                    <strong>Você foi superado!</strong> Seu saldo foi liberado. Dê um novo lance para liderar.
                  </span>
                </div>
              )}

              {userStatus === 'NOT_BIDDING' && isLive && isBidder && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    color: 'var(--gold-300)',
                    fontSize: '0.875rem',
                  }}
                >
                  Líder atual:{' '}
                  <strong>{currentLeaderPseudonym || 'Nenhum lance registrado até o momento'}</strong>
                </div>
              )}
            </div>

            {/* Formulario de Lances (Disponivel apenas se lote ao vivo) */}
            {isLive ? (
              <div>
                {!isAuthenticated ? (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--bg-glass-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                      Faça login como licitante para dar lances ao vivo neste lote.
                    </p>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Dica: utilize os botões da barra superior para trocar rapidamente entre as personas de teste
                      (Ana ou Bruno).
                    </div>
                  </div>
                ) : isAuctioneer ? (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--bg-glass-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <Lock size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Regra de compliance: o leiloeiro não pode participar como licitante no leilão.
                  </div>
                ) : userStatus === 'WINNING' ? (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--bg-glass-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.875rem',
                    }}
                  >
                    Você já é o líder da disputa. Aguarde outro licitante cobrir seu lance para dar um novo.
                  </div>
                ) : (
                  <div>
                    {/* Botoes de Lance Rapido */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Lances Rápidos Sugeridos
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.35rem' }}>
                        {[
                          minNextBidCents,
                          minNextBidCents + lot.minIncrementCents,
                          minNextBidCents + lot.minIncrementCents * 3,
                        ].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setCustomAmountCents(amount)}
                            className={`btn ${customAmountCents === amount ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                          >
                            <span className="mono">{formatCurrency(amount)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input de Valor Personalizado e Botao de Confirmacao */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          className="form-input mono"
                          min={minNextBidCents / 100}
                          step={lot.minIncrementCents / 100}
                          value={customAmountCents / 100}
                          onChange={(e) => setCustomAmountCents(Math.round(Number(e.target.value) * 100))}
                          style={{ fontSize: '1.1rem', fontWeight: 600 }}
                        />
                      </div>
                      <button
                        onClick={() => handlePlaceBid(customAmountCents)}
                        disabled={submittingBid || !hasSufficientBalance}
                        className="btn btn-primary"
                        style={{ padding: '0.65rem 1.5rem', minWidth: '150px' }}
                      >
                        <Gavel size={17} />
                        <span>{submittingBid ? 'Enviando...' : 'Confirmar Lance'}</span>
                      </button>
                    </div>

                    {/* Alerta de saldo insuficiente */}
                    {!hasSufficientBalance && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--alert-red)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '0.5rem',
                        }}
                      >
                        <span>Saldo disponível insuficiente ({formatCurrency(availableBalance)})</span>
                        <button
                          onClick={onOpenWalletModal}
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <Wallet size={12} />
                          <span>Fazer Depósito</span>
                        </button>
                      </div>
                    )}

                    {/* Mensagens de Sucesso ou Erro */}
                    {bidSuccessMessage && (
                      <div
                        className="animate-fade-in"
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.55rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#34d399',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>{bidSuccessMessage}</span>
                      </div>
                    )}

                    {bidError && (
                      <div
                        className="animate-fade-in"
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.55rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#f87171',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <AlertTriangle size={15} />
                        <span>{bidError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--bg-glass-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ color: 'var(--text-muted)', fontSize: '0.925rem' }}>
                  {isFinished ? 'Este leilão foi encerrado e liquidado.' : 'Este leilão ainda não foi aberto.'}
                </div>
                {isFinished && (
                  <button
                    onClick={() => onOpenReceipt(lotId)}
                    className="btn btn-primary"
                    style={{ marginTop: '0.75rem', padding: '0.5rem 1.25rem' }}
                  >
                    <Award size={16} />
                    <span>Abrir Comprovante de Arremate</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Feed de Lances Auditavel em Tempo Real */}
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="var(--audit-blue)" />
                <h3 style={{ fontSize: '1.15rem' }}>Histórico Criptográfico de Lances</h3>
              </div>
              <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {bids.length} lance{bids.length === 1 ? '' : 's'} encadeados
              </span>
            </div>

            {bids.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Nenhum lance submetido até o momento. Seja o primeiro a disputar esta obra!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '420px', overflowY: 'auto' }}>
                {bids.map((bid, index) => {
                  const isLeader = index === 0;
                  return (
                    <div
                      key={bid.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: bid.isMine
                          ? 'rgba(245, 158, 11, 0.08)'
                          : isLeader
                            ? 'rgba(16, 185, 129, 0.06)'
                            : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${
                          bid.isMine
                            ? 'rgba(245, 158, 11, 0.3)'
                            : isLeader
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'var(--bg-glass-border)'
                        }`,
                        borderRadius: 'var(--radius-md)',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {bid.bidderPseudonym}
                          </span>
                          {bid.isMine && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                background: 'var(--gold-500)',
                                color: '#000',
                                padding: '0.1rem 0.45rem',
                                borderRadius: 'var(--radius-full)',
                                fontWeight: 700,
                              }}
                            >
                              Você
                            </span>
                          )}
                          {isLeader && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                background: 'var(--live-green)',
                                color: '#000',
                                padding: '0.1rem 0.45rem',
                                borderRadius: 'var(--radius-full)',
                                fontWeight: 700,
                              }}
                            >
                              Líder
                            </span>
                          )}
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.15rem',
                          }}
                          title={`Hash SHA-256: ${bid.hash}`}
                        >
                          Hash: {truncateHash(bid.hash, 6)} • {formatDateTime(bid.createdAt)}
                        </div>
                      </div>

                      <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(bid.amountCents)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
