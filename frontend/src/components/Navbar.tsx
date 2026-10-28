import React from 'react';
import {
  Gavel,
  Wallet,
  UserCheck,
  LogOut,
  Moon,
  Sun,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

interface NavbarProps {
  currentTab: 'showcase' | 'live' | 'auctioneer' | 'wallet' | 'receipt' | 'audit';
  onSelectTab: (tab: 'showcase' | 'auctioneer' | 'wallet') => void;
  onOpenLogin: () => void;
  onOpenWalletModal: () => void;
  isWalletModalOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenLogin,
  onOpenWalletModal,
  isWalletModalOpen = false,
}) => {
  const { user, wallet, isAuthenticated, isAuctioneer, isBidder, logout, quickLoginAs } = useAuth();
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: 'var(--bg-glass)',
        borderBottom: '1px solid var(--bg-glass-border)',
        padding: '0.75rem 1.5rem',
      }}
    >
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Brand */}
        <div
          onClick={() => onSelectTab('showcase')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            cursor: 'pointer',
          }}
        >
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
          <div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '1.25rem',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              AURORA
            </div>
            <div
              style={{
                fontSize: '0.675rem',
                color: 'var(--gold-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 600,
              }}
            >
              Casa de Leilões
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => onSelectTab('showcase')}
            className={`btn ${currentTab === 'showcase' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.875rem' }}
          >
            <Layers size={16} />
            <span>Vitrine</span>
          </button>

          {isAuctioneer && (
            <button
              onClick={() => onSelectTab('auctioneer')}
              className={`btn ${currentTab === 'auctioneer' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.875rem' }}
            >
              <Gavel size={16} />
              <span>Painel do Leiloeiro</span>
            </button>
          )}

          {isBidder && (
            <button
              onClick={onOpenWalletModal}
              className={`btn ${isWalletModalOpen ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.875rem' }}
            >
              <Wallet size={16} />
              <span>Minha Carteira & Arremates</span>
            </button>
          )}
        </nav>

        {/* Right Section: Persona Switcher, Wallet chip, Theme & Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Quick Evaluator Role Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--bg-glass-border)',
              borderRadius: 'var(--radius-full)',
              padding: '0.2rem 0.35rem',
              gap: '0.25rem',
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                paddingLeft: '0.35rem',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Persona:
            </span>
            <button
              onClick={() => quickLoginAs('leiloeiro@casadeleiloes.dev')}
              style={{
                fontSize: '0.725rem',
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                background: user?.email === 'leiloeiro@casadeleiloes.dev' ? 'var(--gold-500)' : 'transparent',
                color: user?.email === 'leiloeiro@casadeleiloes.dev' ? '#000' : 'var(--text-secondary)',
                fontWeight: user?.email === 'leiloeiro@casadeleiloes.dev' ? 700 : 500,
              }}
              title="Entrar como Roberto Leiloeiro"
            >
              Roberto
            </button>
            <button
              onClick={() => quickLoginAs('ana@casadeleiloes.dev')}
              style={{
                fontSize: '0.725rem',
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                background: user?.email === 'ana@casadeleiloes.dev' ? 'var(--gold-500)' : 'transparent',
                color: user?.email === 'ana@casadeleiloes.dev' ? '#000' : 'var(--text-secondary)',
                fontWeight: user?.email === 'ana@casadeleiloes.dev' ? 700 : 500,
              }}
              title="Entrar como Ana (Licitante)"
            >
              Ana
            </button>
            <button
              onClick={() => quickLoginAs('bruno@casadeleiloes.dev')}
              style={{
                fontSize: '0.725rem',
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                background: user?.email === 'bruno@casadeleiloes.dev' ? 'var(--gold-500)' : 'transparent',
                color: user?.email === 'bruno@casadeleiloes.dev' ? '#000' : 'var(--text-secondary)',
                fontWeight: user?.email === 'bruno@casadeleiloes.dev' ? 700 : 500,
              }}
              title="Entrar como Bruno (Licitante)"
            >
              Bruno
            </button>
          </div>

          {/* Bidder Wallet Chip */}
          {isBidder && wallet && (
            <div
              onClick={onOpenWalletModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              title="Clique para gerenciar carteira e fazer deposito simulado"
            >
              <Wallet size={15} color="#34d399" />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.625rem', color: '#6ee7b7', textTransform: 'uppercase', lineHeight: 1 }}>
                  Disponivel
                </span>
                <span className="mono" style={{ fontSize: '0.825rem', fontWeight: 600, color: '#34d399' }}>
                  {formatCurrency(wallet.availableBalanceCents)}
                </span>
              </div>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ padding: '0.45rem', borderRadius: 'var(--radius-full)' }}
            title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Auth button */}
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <div style={{ textAlign: 'right', display: 'none' }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{user?.name}</div>
              </div>
              <button
                onClick={logout}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
                title="Sair da conta"
              >
                <LogOut size={15} />
                <span>Sair</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="btn btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <UserCheck size={16} />
              <span>Entrar / Cadastrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
