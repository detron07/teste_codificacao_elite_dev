import React, { useEffect, useState } from 'react';
import { AuctioneerDashboardView } from './components/AuctioneerDashboardView';
import { AuditModal } from './components/AuditModal';
import { LiveRoomView } from './components/LiveRoomView';
import { LoginModal } from './components/LoginModal';
import { Navbar } from './components/Navbar';
import { ReceiptModal } from './components/ReceiptModal';
import { ShowcaseView } from './components/ShowcaseView';
import { WalletModal } from './components/WalletModal';
import { AuthProvider } from './context/AuthContext';
import { ShieldCheck, Gavel, Award } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'showcase' | 'live' | 'auctioneer' | 'wallet' | 'receipt' | 'audit'>('showcase');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  // Modais
  const [auditModalLotId, setAuditModalLotId] = useState<string | null>(null);
  const [receiptModalLotId, setReceiptModalLotId] = useState<string | null>(null);
  const [receiptModalReceiptId, setReceiptModalReceiptId] = useState<string | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Leitura inicial de parametros da URL (suporte a link compartilhavel de comprovante e lote)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const comprovanteId = params.get('comprovante');
    const loteId = params.get('lote');

    if (comprovanteId) {
      setReceiptModalReceiptId(comprovanteId);
    } else if (loteId) {
      setSelectedLotId(loteId);
      setCurrentTab('live');
    }
  }, []);

  const handleEnterLot = (lotId: string) => {
    setSelectedLotId(lotId);
    setCurrentTab('live');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAudit = (lotId: string) => {
    setAuditModalLotId(lotId);
  };

  const handleOpenReceipt = (lotId: string) => {
    setReceiptModalLotId(lotId);
    setReceiptModalReceiptId(null);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'wallet') {
            setIsWalletModalOpen(true);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentTab === 'showcase' && (
          <ShowcaseView
            onEnterLot={handleEnterLot}
            onOpenAudit={handleOpenAudit}
            onOpenReceipt={handleOpenReceipt}
          />
        )}

        {currentTab === 'live' && selectedLotId && (
          <LiveRoomView
            lotId={selectedLotId}
            onBack={() => {
              setCurrentTab('showcase');
              setSelectedLotId(null);
            }}
            onOpenAudit={handleOpenAudit}
            onOpenReceipt={handleOpenReceipt}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
          />
        )}

        {currentTab === 'auctioneer' && (
          <AuctioneerDashboardView
            onEnterLot={handleEnterLot}
            onOpenAudit={handleOpenAudit}
            onOpenReceipt={handleOpenReceipt}
          />
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--bg-glass-border)',
          backgroundColor: 'rgba(10, 11, 17, 0.95)',
          padding: '2.5rem 1.5rem',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: '1360px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Gavel size={18} color="var(--gold-400)" />
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                CASA DE LEILÕES AURORA
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Desenvolvido para o Desafio Técnico — Elite Dev na Verzel.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={15} color="var(--audit-blue)" />
              <span>SHA-256 Merkle Chaining</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Award size={15} color="var(--gold-400)" />
              <span>Cleveland Museum of Art Open Access</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>LGPD Deterministic Pseudonyms</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modais Globais */}
      <AuditModal
        lotId={auditModalLotId}
        onClose={() => setAuditModalLotId(null)}
      />

      <ReceiptModal
        lotId={receiptModalLotId}
        receiptId={receiptModalReceiptId}
        onClose={() => {
          setReceiptModalLotId(null);
          setReceiptModalReceiptId(null);
        }}
      />

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onOpenReceipt={handleOpenReceipt}
        onEnterLot={handleEnterLot}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
