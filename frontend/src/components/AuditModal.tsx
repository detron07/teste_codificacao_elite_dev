import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  X,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import type { LotAuditResult } from '../types';
import { formatCurrency, formatDateTime } from '../utils/format';

interface AuditModalProps {
  lotId: string | null;
  onClose: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({ lotId, onClose }) => {
  const [audit, setAudit] = useState<LotAuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    if (!lotId) return;

    const loadAudit = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getLotAudit(lotId);
        setAudit(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao realizar auditoria criptográfica');
      } finally {
        setLoading(false);
      }
    };

    void loadAudit();
  }, [lotId]);

  if (!lotId) return null;

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2500);
  };

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
          maxWidth: '900px',
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
        {/* Modal Header */}
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
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} color="var(--audit-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>Auditoria Criptográfica de Lances</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Verificação matemática independente de hash chain (Merkle Chaining)
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

        {/* Modal Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Recalculando hashes SHA-256 e verificando elos da cadeia...
            </div>
          ) : error || !audit ? (
            <div style={{ padding: '2rem', color: 'var(--alert-red)', textAlign: 'center' }}>
              {error || 'Não foi possível carregar o relatório de auditoria'}
            </div>
          ) : (
            <div>
              {/* Resultado Geral do Lote */}
              <div
                style={{
                  background:
                    audit.status === 'INTEGRO'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${
                    audit.status === 'INTEGRO' ? 'rgba(16, 185, 129, 0.3)' : 'var(--alert-red)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {audit.status === 'INTEGRO' ? (
                    <ShieldCheck size={28} color="var(--live-green)" />
                  ) : (
                    <AlertTriangle size={28} color="var(--alert-red)" />
                  )}
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Status de Integridade do Lote
                    </div>
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: audit.status === 'INTEGRO' ? '#34d399' : '#f87171',
                      }}
                    >
                      {audit.status === 'INTEGRO'
                        ? 'CADEIA 100% ÍNTEGRA E AUTÊNTICA'
                        : 'ADULTERAÇÃO OU FRAUDE DETECTADA'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                  <div>Lote: <strong>{audit.lotTitle}</strong></div>
                  <div>Verificado em: {formatDateTime(audit.verifiedAt)}</div>
                </div>
              </div>

              {/* Se houver violacao detectada */}
              {audit.violation && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--alert-red)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    color: '#f87171',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                    Violação detectada no lance #{audit.violation.sequenceIndex}:
                  </div>
                  <div style={{ fontSize: '0.9rem' }}>{audit.violation.reason}</div>
                </div>
              )}

              {/* Informacoes de Hash Genesis e Head */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--bg-glass-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Hash Gênesis (1º Lance)
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--audit-blue)',
                      wordBreak: 'break-all',
                      marginTop: '0.35rem',
                    }}
                  >
                    {audit.genesisHash || 'Nenhum lance registrado'}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--bg-glass-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Head Hash (Último Lance Liderando)
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--gold-400)',
                      wordBreak: 'break-all',
                      marginTop: '0.35rem',
                    }}
                  >
                    {audit.headHash || 'Nenhum lance registrado'}
                  </div>
                </div>
              </div>

              {/* Visualizacao dos Nós da Cadeia */}
              <h4
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.85rem',
                }}
              >
                Nós da Hash Chain ({audit.chain.length})
              </h4>

              {audit.chain.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Este lote ainda não recebeu lances para formar a cadeia criptográfica.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {audit.chain.map((node) => (
                    <div
                      key={node.bidId}
                      style={{
                        background: node.isValid ? 'rgba(255, 255, 255, 0.03)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${node.isValid ? 'var(--bg-glass-border)' : 'var(--alert-red)'}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.65rem',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              background: 'var(--gold-500)',
                              color: '#000',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            #{node.sequenceIndex}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.925rem' }}>
                            {node.bidderPseudonym}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            • {formatDateTime(node.createdAt)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span className="mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gold-400)' }}>
                            {formatCurrency(node.amountCents)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              background: node.isValid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                              color: node.isValid ? '#34d399' : '#f87171',
                              fontWeight: 600,
                            }}
                          >
                            {node.isValid ? 'Elo Válido' : 'Adulterado'}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '0.75rem',
                          background: 'rgba(10, 11, 17, 0.6)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem 0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Previous Hash:</span>
                          <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                            {node.previousHash || '0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Hash Calculado:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="mono" style={{ color: 'var(--audit-blue)' }}>
                              {node.hash}
                            </span>
                            <button
                              onClick={() => copyToClipboard(node.hash)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                              }}
                              title="Copiar hash SHA-256"
                            >
                              {copiedHash === node.hash ? <Check size={13} color="var(--live-green)" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Explicacao Tecnica da Solucao */}
              <div
                style={{
                  marginTop: '1.75rem',
                  padding: '1.25rem',
                  background: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--audit-blue)',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                  }}
                >
                  <Info size={16} />
                  <span>Como funciona a prova criptográfica (Tamper-Proof) e privacidade LGPD</span>
                </div>
                <p style={{ marginBottom: '0.5rem' }}>{audit.techniqueExplanation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
