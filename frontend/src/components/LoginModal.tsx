import React, { useState } from 'react';
import {
  X,
  UserCheck,
  UserPlus,
  Gavel,
  Wallet,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, register, quickLoginAs } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('BIDDER');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password, role);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (targetEmail: string) => {
    setLoading(true);
    setError(null);
    try {
      await quickLoginAs(targetEmail);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
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
          maxWidth: '480px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--bg-glass-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {mode === 'login' ? <UserCheck size={20} color="var(--gold-400)" /> : <UserPlus size={20} color="var(--gold-400)" />}
            <h3 style={{ fontSize: '1.2rem' }}>{mode === 'login' ? 'Acessar Conta' : 'Criar Nova Conta'}</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.35rem', borderRadius: 'var(--radius-full)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Quick Evaluator Access */}
        <div style={{ padding: '1.25rem 1.5rem 0.5rem', background: 'rgba(255, 255, 255, 0.02)' }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--gold-400)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Sparkles size={12} />
            <span>Acesso Rápido de Avaliador (1 Clique)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('leiloeiro@casadeleiloes.dev')}
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '0.55rem 0.85rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Gavel size={15} color="var(--gold-400)" />
                <span style={{ fontSize: '0.85rem' }}>Roberto (Leiloeiro)</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cria lotes & visualiza métricas</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('ana@casadeleiloes.dev')}
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '0.55rem 0.85rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={15} color="var(--live-green)" />
                <span style={{ fontSize: '0.85rem' }}>Ana (Licitante)</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saldo R$ 50.000,00</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('bruno@casadeleiloes.dev')}
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '0.55rem 0.85rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={15} color="var(--live-green)" />
                <span style={{ fontSize: '0.85rem' }}>Bruno (Licitante)</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saldo R$ 30.000,00 (Líder ao vivo)</span>
            </button>
          </div>
        </div>

        {/* Separador */}
        <div style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--bg-glass-border)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ou credenciais</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--bg-glass-border)' }} />
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ padding: '0.5rem 1.5rem 1.5rem' }}>
          {error && (
            <div
              style={{
                padding: '0.65rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#f87171',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Nome Completo
              </label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ex: Carlos Albuquerque"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
              E-mail
            </label>
            <input
              type="email"
              required
              className="form-input"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
              Senha
            </label>
            <input
              type="password"
              required
              className="form-input"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Perfil de Acesso
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setRole('BIDDER')}
                  className={`btn ${role === 'BIDDER' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.45rem', fontSize: '0.825rem' }}
                >
                  <Wallet size={14} />
                  <span>Licitante</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('AUCTIONEER')}
                  className={`btn ${role === 'AUCTIONEER' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.45rem', fontSize: '0.825rem' }}
                >
                  <Gavel size={14} />
                  <span>Leiloeiro</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.65rem', fontSize: '0.95rem' }}
          >
            <span>{loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Concluir Cadastro'}</span>
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            {mode === 'login' ? (
              <span>
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  style={{ background: 'none', border: 'none', color: 'var(--gold-400)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cadastre-se
                </button>
              </span>
            ) : (
              <span>
                Já possui conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--gold-400)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Faça login
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
