import React, { useEffect, useState } from 'react';
import {
  Wallet,
  X,
  PlusCircle,
  Award,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { BidderParticipationsView } from '../types';
import { formatCurrency, formatDateTime } from '../utils/format';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReceipt: (lotId: string) => void;
  onEnterLot: (lotId: string) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  onOpenReceipt,
  onEnterLot,
}) => {
  const { wallet, refreshWallet, user } = useAuth();
  const [participations, setParticipations] = useState<BidderParticipationsView | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'won' | 'active' | 'ledger'>('overview');

  // Formulario de Deposito
  const [depositAmountCents, setDepositAmountCents] = useState<number>(500000); // R$ 5.000,00
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const p = await api.getMyBids();
      setParticipations(p);
      await refreshWallet();
    } catch {
      // Ignora falha de carregamento
    }
  };

  useEffect(() => {
    if (isOpen && user?.role === 'BIDDER') {
      void loadData();
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const handleDeposit = async () => {
    if (depositAmountCents <= 0) return;
    setSubmittingDeposit(true);
    setDepositError(null);
    setDepositSuccess(null);

    try {
      await api.deposit(depositAmountCents);
      setDepositSuccess(`Depósito simulado de ${formatCurrency(depositAmountCents)} creditado com sucesso!`);
      await refreshWallet();
      setTimeout(() => setDepositSuccess(null), 4000);
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'Falha ao processar depósito');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const wonLots = participations?.won || [];
  const activeBids = participations?.active || [];
  const transactions = wallet?.transactions || wallet?.recentTransactions || [];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 6, 12, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--bg-glass-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--bg-glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wallet size={20} color="var(--live-green)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>Minha Carteira & Arremates</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Gestão de saldo, depósito simulado e comprovantes conquistados
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.4rem', borderRadius: 'var(--radius-full)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '0 1.5rem',
            borderBottom: '1px solid var(--bg-glass-border)',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '0.85rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'overview' ? 'var(--gold-500)' : 'transparent'}`,
              color: activeTab === 'overview' ? 'var(--gold-400)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Visão Geral & Depósito
          </button>

          <button
            onClick={() => setActiveTab('won')}
            style={{
              padding: '0.85rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'won' ? 'var(--gold-500)' : 'transparent'}`,
              color: activeTab === 'won' ? 'var(--gold-400)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>Meus Arremates</span>
            {wonLots.length > 0 && (
              <span
                style={{
                  background: 'var(--gold-500)',
                  color: '#000',
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                }}
              >
                {wonLots.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: '0.85rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'active' ? 'var(--gold-500)' : 'transparent'}`,
              color: activeTab === 'active' ? 'var(--gold-400)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>Lances Ativos ({activeBids.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            style={{
              padding: '0.85rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'ledger' ? 'var(--gold-500)' : 'transparent'}`,
              color: activeTab === 'ledger' ? 'var(--gold-400)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Livro-Razão ({transactions.length})
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* ABA 1: VISAO GERAL & DEPOSITO */}
          {activeTab === 'overview' && (
            <div>
              {/* Cards de Saldo */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}
              >
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#6ee7b7', textTransform: 'uppercase', fontWeight: 600 }}>
                    Saldo Disponível
                  </div>
                  <div className="mono" style={{ fontSize: '1.85rem', fontWeight: 700, color: '#34d399', margin: '0.35rem 0' }}>
                    {formatCurrency(wallet?.availableBalanceCents || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Livre para novos lances
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--gold-300)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Saldo Comprometido
                  </div>
                  <div className="mono" style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--gold-400)', margin: '0.35rem 0' }}>
                    {formatCurrency(wallet?.committedBalanceCents || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Reservado em lotes que você lidera
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--bg-glass-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Saldo Total
                  </div>
                  <div className="mono" style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.35rem 0' }}>
                    {formatCurrency(wallet?.totalBalanceCents || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Total depositado na carteira
                  </div>
                </div>
              </div>

              {/* Box de Deposito Simulado */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--bg-glass-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <PlusCircle size={18} color="var(--gold-400)" />
                  <h4 style={{ fontSize: '1.1rem' }}>Realizar Depósito Simulado</h4>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  Adicione saldo simulado à sua carteira para participar dos leilões e disputar obras de arte.
                  Todo depósito é registrado com integridade no livro-razão (append-only ledger).
                </p>

                {/* Botoes de Valor Rapido */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {[100000, 500000, 1000000, 2500000].map((cents) => (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => setDepositAmountCents(cents)}
                      className={`btn ${depositAmountCents === cents ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                    >
                      <span className="mono">+{formatCurrency(cents)}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    className="form-input mono"
                    min="1"
                    step="100"
                    value={depositAmountCents / 100}
                    onChange={(e) => setDepositAmountCents(Math.round(Number(e.target.value) * 100))}
                    style={{ flex: 1, minWidth: '180px', fontSize: '1.1rem', fontWeight: 600 }}
                  />

                  <button
                    onClick={handleDeposit}
                    disabled={submittingDeposit || depositAmountCents <= 0}
                    className="btn btn-primary"
                    style={{ padding: '0.65rem 1.5rem' }}
                  >
                    <span>{submittingDeposit ? 'Creditando...' : 'Confirmar Depósito'}</span>
                  </button>
                </div>

                {depositSuccess && (
                  <div
                    className="animate-fade-in"
                    style={{
                      marginTop: '1rem',
                      padding: '0.65rem 1rem',
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
                    <span>{depositSuccess}</span>
                  </div>
                )}

                {depositError && (
                  <div
                    className="animate-fade-in"
                    style={{
                      marginTop: '1rem',
                      padding: '0.65rem 1rem',
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
                    <span>{depositError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 2: MEUS ARREMATES */}
          {activeTab === 'won' && (
            <div>
              {wonLots.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Award size={36} color="var(--gold-500)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>Você ainda não possui lotes arrematados.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Participe dos leilões ao vivo para conquistar obras raras e receber seu comprovante de arremate oficial!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {wonLots.map((lot) => (
                    <div
                      key={lot.lotId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem 1.25rem',
                        background: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img
                          src={lot.imageUrl}
                          alt={lot.title}
                          style={{
                            width: '64px',
                            height: '64px',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gold-400)', fontWeight: 600, textTransform: 'uppercase' }}>
                            Arrematado • Registro {lot.receiptNumber}
                          </div>
                          <h4 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', margin: '0.2rem 0' }}>
                            {lot.title}
                          </h4>
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                            Liquidado em: {formatDateTime(lot.settledAt)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Valor Pago
                          </div>
                          <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gold-400)' }}>
                            {formatCurrency(lot.finalPriceCents)}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            onClose();
                            onOpenReceipt(lot.lotId);
                          }}
                          className="btn btn-primary"
                          style={{ padding: '0.45rem 0.95rem', fontSize: '0.825rem' }}
                        >
                          <Award size={15} />
                          <span>Ver Comprovante</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: LANCES ATIVOS */}
          {activeTab === 'active' && (
            <div>
              {activeBids.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Você não está disputando nenhum lote ao vivo no momento.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {activeBids.map((b) => (
                    <div
                      key={b.lotId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem 1.25rem',
                        background: b.isLeading ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        border: `1px solid ${b.isLeading ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        borderRadius: 'var(--radius-md)',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img
                          src={b.imageUrl}
                          alt={b.title}
                          style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                        />
                        <div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: b.isLeading ? '#34d399' : '#f87171',
                              textTransform: 'uppercase',
                            }}
                          >
                            {b.isLeading ? 'Você é o líder atual' : 'Você foi superado'}
                          </div>
                          <h4 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-serif)', margin: '0.15rem 0' }}>
                            {b.title}
                          </h4>
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                            Seu maior lance: {formatCurrency(b.myHighestBidCents)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Lance Atual
                          </div>
                          <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gold-400)' }}>
                            {formatCurrency(b.currentPriceCents)}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            onClose();
                            onEnterLot(b.lotId);
                          }}
                          className="btn btn-primary"
                          style={{ padding: '0.45rem 0.95rem', fontSize: '0.825rem' }}
                        >
                          <span>Ir para a Sala</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 4: LIVRO-RAZAO (LEDGER) */}
          {activeTab === 'ledger' && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Registro contábil estrito (append-only) de todas as transações da sua carteira:
              </div>

              {transactions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma transação registrada.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {transactions.map((tx) => {
                    const isCredit = tx.amountCents > 0;
                    return (
                      <div
                        key={tx.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--bg-glass-border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-full)',
                              background: isCredit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isCredit ? (
                              <ArrowDownLeft size={16} color="var(--live-green)" />
                            ) : (
                              <ArrowUpRight size={16} color="var(--alert-red)" />
                            )}
                          </div>

                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              {tx.description || (isCredit ? 'Depósito Simulado' : 'Débito de Liquidação')}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {formatDateTime(tx.createdAt)}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            className="mono"
                            style={{
                              fontSize: '1rem',
                              fontWeight: 700,
                              color: isCredit ? 'var(--live-green)' : 'var(--alert-red)',
                            }}
                          >
                            {isCredit ? '+' : ''}
                            {formatCurrency(tx.amountCents)}
                          </div>
                          <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Saldo após: {formatCurrency(tx.balanceAfterCents)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
