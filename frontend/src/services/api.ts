import type {
  ArtworkSearchResult,
  AuctioneerDashboardMetrics,
  AuthResponse,
  BidderParticipationsView,
  BidView,
  LiveRoomState,
  LotAuditResult,
  LotView,
  PublicReceiptView,
  Role,
  ShowcaseResponse,
  User,
  WalletView,
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expirado ou invalido
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    if (!response.ok) {
      let errorMessage = `Erro HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message || errorMessage;
      } catch {
        // Ignora falha de parse
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // --- Auth ---
  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(name: string, email: string, password: string, role: Role): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
  }

  async me(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // --- Vitrine e Lotes ---
  async getShowcase(): Promise<ShowcaseResponse> {
    return this.request<ShowcaseResponse>('/lots/showcase');
  }

  async getLotById(id: string): Promise<LotView> {
    return this.request<LotView>(`/lots/${id}`);
  }

  async createLot(data: {
    title: string;
    description?: string;
    externalItemId: string;
    imageUrl: string;
    itemAttributes: Record<string, unknown>;
    startPriceCents: number;
    minIncrementCents: number;
    startsAt?: string;
    endsAt: string;
  }): Promise<LotView> {
    return this.request<LotView>('/lots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelLot(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/lots/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getMyAuctioneerLots(): Promise<AuctioneerDashboardMetrics> {
    return this.request<AuctioneerDashboardMetrics>('/lots/auctioneer/my-lots');
  }

  // --- Motor de Lances ---
  async getLiveRoomState(lotId: string): Promise<LiveRoomState> {
    return this.request<LiveRoomState>(`/lots/${lotId}/live-room`);
  }

  async getLotBids(lotId: string): Promise<BidView[]> {
    return this.request<BidView[]>(`/lots/${lotId}/bids`);
  }

  async placeBid(lotId: string, amountCents: number): Promise<{
    bid: BidView;
    lotId: string;
    currentPriceCents: number;
    endsAt: string;
    wasExtended: boolean;
    isWinning: boolean;
  }> {
    return this.request(`/lots/${lotId}/bids`, {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    });
  }

  // --- Carteira ---
  async getWallet(): Promise<WalletView> {
    return this.request<WalletView>('/wallet/me');
  }

  async deposit(amountCents: number): Promise<{
    success: boolean;
    amountCents: number;
    newBalanceCents: number;
    transactionId: string;
  }> {
    return this.request('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    });
  }

  // --- Auditoria Criptografica ---
  async getLotAudit(lotId: string): Promise<LotAuditResult> {
    return this.request<LotAuditResult>(`/lots/${lotId}/audit`);
  }

  // --- Comprovantes e Arremates ---
  async getReceiptById(receiptId: string): Promise<PublicReceiptView> {
    return this.request<PublicReceiptView>(`/receipts/${receiptId}`);
  }

  async getReceiptByLotId(lotId: string): Promise<PublicReceiptView> {
    return this.request<PublicReceiptView>(`/lots/${lotId}/receipt`);
  }

  async getMyBids(): Promise<BidderParticipationsView> {
    return this.request<BidderParticipationsView>('/lots/bidder/my-bids');
  }

  async settleLot(lotId: string): Promise<{
    lotId: string;
    settled: boolean;
    hadWinner: boolean;
    receiptId?: string;
    receiptNumber?: string;
    finalPriceCents?: number;
  }> {
    return this.request(`/lots/${lotId}/settle`, {
      method: 'POST',
    });
  }

  // --- Obras de Arte (Cleveland Museum) ---
  async searchArtworks(query: string): Promise<ArtworkSearchResult[]> {
    const res = await this.request<{ items: ArtworkSearchResult[]; total: number } | ArtworkSearchResult[]>(
      `/artworks/search?q=${encodeURIComponent(query)}`,
    );
    if (Array.isArray(res)) return res;
    return res?.items || [];
  }
}

export const api = new ApiClient();
