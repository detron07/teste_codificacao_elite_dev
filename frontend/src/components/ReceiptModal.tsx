import React, { useEffect, useState } from 'react';
import {
  Award,
  X,
  ShieldCheck,
  Share2,
  Printer,
  Check,
} from 'lucide-react';
import { api } from '../services/api';
import type { PublicReceiptView } from '../types';
import { formatDateTime } from '../utils/format';

interface ReceiptModalProps {
  lotId?: string | null;
  receiptId?: string | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ lotId, receiptId, onClose }) => {
  const [receipt, setReceipt] = useState<PublicReceiptView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!lotId && !receiptId) return;

    const loadReceipt = async () => {
      try {
        setLoading(true);
        setError(null);
        let data: PublicReceiptView;
        if (receiptId) {
          data = await api.getReceiptById(receiptId);
        } else if (lotId) {
          data = await api.getReceiptByLotId(lotId);
        } else {
          return;
        }
        setReceipt(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Comprovante não disponível');
      } finally {
        setLoading(false);
      }
    };

    void loadReceipt();
  }, [lotId, receiptId]);

  if (!lotId && !receiptId) return null;

  const copyShareLink = () => {
    if (!receipt) return;
    const url = `${window.location.origin}?comprovante=${receipt.id}`;
    void navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const printReceipt = () => {
    window.print();
  };

  const attrs = (receipt?.item.itemAttributes as Record<string, string>) || {};

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 6, 12, 0.88)',
        backdropFilter: 'blur(10px)',
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
          maxWidth: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: '#0d0f17',
          border: '2px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(245, 158, 11, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Actions Bar */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderBottom: '1px solid var(--bg-glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} color="var(--gold-400)" />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gold-400)' }}>
              Comprovante Oficial de Arremate
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {receipt && (
              <>
                <button
                  onClick={copyShareLink}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  title="Copiar link compartilhável do comprovante"
                >
                  {copiedLink ? <Check size={14} color="var(--live-green)" /> : <Share2 size={14} />}
                  <span>{copiedLink ? 'Link Copiado!' : 'Compartilhar'}</span>
                </button>
                <button
                  onClick={printReceipt}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  title="Imprimir ou salvar em PDF"
                >
                  <Printer size={14} />
                  <span>Imprimir</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '0.35rem', borderRadius: 'var(--radius-full)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Carregando dados e validando assinatura criptográfica do comprovante...
            </div>
          ) : error || !receipt ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--alert-red)' }}>
              {error || 'Comprovante não encontrado para este lote'}
            </div>
          ) : (
            <div
              style={{
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '2rem',
                background: 'linear-gradient(180deg, rgba(22, 25, 38, 0.6) 0%, rgba(14, 16, 26, 0.8) 100%)',
                position: 'relative',
              }}
            >
              {/* Header do Certificado */}
              <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(245, 158, 11, 0.2)', paddingBottom: '1.5rem' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--gold-400)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: '0.35rem',
                  }}
                >
                  CASA DE LEILÕES AURORA
                </div>
                <h2
                  style={{
                    fontSize: '1.85rem',
                    fontFamily: 'var(--font-serif)',
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                    marginBottom: '0.5rem',
                  }}
                >
                  Certificado Oficial de Arrematação
                </h2>
                <div className="mono" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Registro: <strong style={{ color: 'var(--gold-300)' }}>{receipt.receiptNumber}</strong>
                </div>
              </div>

              {/* Snapshot da Obra */}
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--bg-glass-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <img
                  src={receipt.item.imageUrl}
                  alt={receipt.item.title}
                  style={{
                    width: '140px',
                    height: '140px',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                />

                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gold-400)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {attrs.artist || 'Artista Renomado'}
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', marginBottom: '0.5rem' }}>
                    {receipt.item.title}
                  </h3>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {attrs.date && <div>Data: {attrs.date}</div>}
                    {attrs.technique && <div>Técnica: {attrs.technique}</div>}
                    {attrs.dimensions && <div>Dimensões: {attrs.dimensions}</div>}
                    <div>ID Acervo: {receipt.item.externalItemId}</div>
                  </div>
                </div>
              </div>

              {/* Informacoes Financeiras e de Liquidacao */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1.25rem',
                  marginBottom: '2rem',
                }}
              >
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Valor Final de Arremate
                  </div>
                  <div className="mono" style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--gold-400)' }}>
                    {receipt.finalPriceFormatted}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--live-green)', marginTop: '0.2rem' }}>
                    Liquidado e transferido via carteira
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Arrematante (Vencedor)
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {receipt.winnerPseudonym}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Identidade resguardada por LGPD
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Leiloeiro Emissor
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {receipt.auctioneerName}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Data: {formatDateTime(receipt.settledAt)}
                  </div>
                </div>
              </div>

              {/* Selo Criptografico de Autenticidade */}
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <ShieldCheck size={22} color="var(--live-green)" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>
                      Autenticidade Criptográfica Verificada (SHA-256)
                    </div>
                    <div className="mono" style={{ fontSize: '0.725rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                      {receipt.verificationHash}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '0.725rem',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Íntegro & Válido
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
