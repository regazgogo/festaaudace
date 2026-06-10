'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

type PendingOrder = {
  id: string;
  customer_name: string;
  pickup_code: string;
  amount_cents: number;
  credits_purchased: number;
  payment_status: string;
  created_at: string;
};

type WalletRow = {
  customer_name: string;
  pickup_code: string;
  payment_status?: string;
  amount_cents?: number;
  credits_purchased?: number;
  credits_available?: number;
  included_credits_available?: number;
  paid_credits_available?: number;
  pending_credits?: number;
  pending_amount_cents?: number;
  pending_order_id?: string | null;
  pending_order_ids?: string[];
  created_at?: string;
  paid_at?: string | null;
};

type AdminTotals = {
  ordiniPagati?: number;
  totaleIncassatoCents?: number;
  creditiVenduti?: number;
  creditiUsati?: number;
  creditiResidui?: number;
  walletAttivi?: number;
  ordiniInAttesa?: number;

  wallets_count?: number;
  approved_credits?: number;
  pending_credits?: number;
  used_credits?: number;
  available_credits?: number;
  approved_amount_cents?: number;
  pending_amount_cents?: number;
};

type AdminData = {
  totals?: AdminTotals;
  pendingOrders?: PendingOrder[];
  orders?: PendingOrder[];
  wallets?: WalletRow[];
};

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function euro(cents: unknown) {
  return `${(safeNumber(cents) / 100).toFixed(0)} €`;
}

function cleanUrl(url: string) {
  return url.replace(/^https?:\/\//, '');
}

export default function AdminPage() {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [adminPin, setAdminPin] = useState('');
  const [data, setData] = useState<AdminData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState('giornata_intera');
  const [createdWalletCode, setCreatedWalletCode] = useState('');
  const [creatingWallet, setCreatingWallet] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAdminData() {
    setError('');
    setMessage('');
    setLoaded(false);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPin }),
      });

      const text = await res.text();

      let json: AdminData & { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        setError(`Risposta non valida da /api/admin/stats: ${text}`);
        setLoaded(false);
        setData(null);
        return;
      }

      if (!res.ok) {
        setError(json.error || `Errore caricamento admin: HTTP ${res.status}`);
        setLoaded(false);
        setData(null);
        return;
      }

      setData(json);
      setLoaded(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore di connessione');
      setLoaded(false);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function getCreatedWalletUrls() {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    const cleanSiteUrl = cleanUrl(siteUrl);

    const walletUrl = `${cleanSiteUrl}/wallet/${createdWalletCode}`;
    const barQrUrl = `${cleanSiteUrl}/bar?code=${createdWalletCode}`;

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
      barQrUrl
    )}`;

    return {
      walletUrl,
      barQrUrl,
      qrImageUrl,
    };
  }

  function shareWalletWhatsapp() {
    if (!createdWalletCode) {
      return;
    }

    const walletNumber = createdWalletCode.split('-')[1];
    const { walletUrl, barQrUrl } = getCreatedWalletUrls();

    const whatsappText = encodeURIComponent(
      `🍸 FESTA AUDACE\n` +
        `Il mio codice wallet è ${createdWalletCode}\n` +
        `Numero wallet: ${walletNumber}\n\n` +
        `Link saldo:\n${walletUrl}\n\n` +
        `Link QR bar:\n${barQrUrl}`
    );

    window.open(`https://wa.me/?text=${whatsappText}`, '_blank');
  }

  async function shareQrPng() {
    const canvas = qrCanvasRef.current;
    const pickupCode = createdWalletCode;

    if (!pickupCode) {
      alert('Nessun wallet creato');
      return;
    }

    if (!canvas) {
      alert('QR non ancora pronto');
      return;
    }

    canvas.toBlob(async (blob) => {
      if (!blob) {
        alert('Impossibile creare il PNG del QR');
        return;
      }

      const file = new File([blob], `festa-audace-${pickupCode}.png`, {
        type: 'image/png',
      });

      const shareData = {
        title: 'FESTA AUDACE - QR Wallet',
        text: `QR wallet ${pickupCode}`,
        files: [file],
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `festa-audace-${pickupCode}.png`;
      link.click();

      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  async function createWallet(event: React.FormEvent) {
    event.preventDefault();

    setError('');
    setMessage('');
    setCreatedWalletCode('');
    setCreatingWallet(true);

    try {
      const res = await fetch('/api/admin/create-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPin,
          customerName: newWalletName,
          walletType: newWalletType,
        }),
      });

      const text = await res.text();

      let json: {
        ok?: boolean;
        error?: string;
        order?: {
          pickup_code: string;
        };
      } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        setError(`Risposta non valida da /api/admin/create-wallet: ${text}`);
        return;
      }

      if (!res.ok) {
        setError(json.error || `Errore creazione wallet: HTTP ${res.status}`);
        return;
      }

      const pickupCode = json.order?.pickup_code || '';

      setNewWalletName('');
      setNewWalletType('giornata_intera');

      await loadAdminData();

      setCreatedWalletCode(pickupCode);
      setMessage(`Wallet creato: ${pickupCode}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore di connessione');
    } finally {
      setCreatingWallet(false);
    }
  }

  async function approveOrder(orderId: string) {
    setError('');
    setMessage('');
    setActionLoading(orderId);

    try {
      const res = await fetch('/api/admin/approve-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPin,
          orderId,
        }),
      });

      const text = await res.text();

      let json: { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        setError(`Risposta non valida da /api/admin/approve-order: ${text}`);
        return;
      }

      if (!res.ok) {
        setError(json.error || `Errore approvazione ordine: HTTP ${res.status}`);
        return;
      }

      setMessage('Ordine approvato');
      await loadAdminData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore di connessione');
    } finally {
      setActionLoading('');
    }
  }

  async function cancelOrder(orderId: string) {
    const confirmed = window.confirm('Confermi di annullare questo ordine?');

    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');
    setActionLoading(orderId);

    try {
      const res = await fetch('/api/admin/cancel-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPin,
          orderId,
        }),
      });

      const text = await res.text();

      let json: { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        setError(`Risposta non valida da /api/admin/cancel-order: ${text}`);
        return;
      }

      if (!res.ok) {
        setError(json.error || `Errore annullamento ordine: HTTP ${res.status}`);
        return;
      }

      setMessage('Ordine annullato');
      await loadAdminData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore di connessione');
    } finally {
      setActionLoading('');
    }
  }

  async function deleteWallet(pickupCode: string) {
    const firstConfirm = window.confirm(
      `Vuoi eliminare il wallet ${pickupCode}?`
    );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm(
      `Conferma definitiva: eliminare ${pickupCode} e tutti i suoi movimenti?`
    );

    if (!secondConfirm) {
      return;
    }

    setError('');
    setMessage('');
    setActionLoading(pickupCode);

    try {
      const res = await fetch('/api/admin/delete-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPin,
          pickupCode,
        }),
      });

      const text = await res.text();

      let json: { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        setError(`Risposta non valida da /api/admin/delete-wallet: ${text}`);
        return;
      }

      if (!res.ok) {
        setError(json.error || `Errore eliminazione wallet: HTTP ${res.status}`);
        return;
      }

      setMessage(`Wallet eliminato: ${pickupCode}`);
      await loadAdminData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore di connessione');
    } finally {
      setActionLoading('');
    }
  }

  const totals = data?.totals || {};
  const pendingOrders = data?.pendingOrders || data?.orders || [];
  const wallets = data?.wallets || [];

  return (
    <main className="container">
      <section className="hero">
        <h1>Admin FESTA AUDACE</h1>
        <p>Gestione wallet, ricariche e crediti drink.</p>
      </section>

      <section className="card">
        <h2>Accesso admin</h2>

        <div className="inlineActions">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            value={adminPin}
            onChange={(event) =>
              setAdminPin(event.target.value.replace(/[^0-9]/g, ''))
            }
            placeholder="PIN admin"
          />

          <button type="button" onClick={loadAdminData} disabled={loading}>
            {loading ? 'Caricamento...' : 'Carica pannello'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
      </section>

      {loaded && (
        <>
          <section className="card">
            <h2>Crea wallet</h2>

            <form onSubmit={createWallet}>
              <label>
                Nome Audace
                <input
                  value={newWalletName}
                  onChange={(event) => setNewWalletName(event.target.value)}
                  placeholder="Es. Filippo"
                  required
                />
              </label>

              <label>
                Tipo wallet
                <select
                  value={newWalletType}
                  onChange={(event) => setNewWalletType(event.target.value)}
                >
                  <option value="giornata_intera">
                    Giornata Intera - 20 crediti FREE
                  </option>
                  <option value="post_cena">Post Cena - 5 crediti FREE</option>
                </select>
              </label>

              <button type="submit" disabled={creatingWallet}>
                {creatingWallet ? 'Creazione...' : 'Crea wallet'}
              </button>
            </form>

            {createdWalletCode && (
              <div className="createdWalletBox">
                <p className="success">
                  Wallet creato: <strong>{createdWalletCode}</strong>
                </p>

                <div className="qrBox">
                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={getCreatedWalletUrls().barQrUrl}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="H"
                    includeMargin
                  />

                  <p>QR da mostrare al bar</p>
                </div>

                <div className="inlineActions">
                  <a
                    className="actionLink"
                    href={`/wallet/${createdWalletCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apri saldo wallet
                  </a>

                  <button type="button" onClick={shareWalletWhatsapp}>
                    Condividi link WhatsApp
                  </button>

                  <button type="button" onClick={shareQrPng}>
                    Condividi QR PNG
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Panoramica generale</h2>

            <div className="statsGrid">
              <div className="statBox">
                <span>Incassato</span>
                <strong>{euro(totals.totaleIncassatoCents)}</strong>
              </div>

              <div className="statBox">
                <span>Ordini pagati</span>
                <strong>{safeNumber(totals.ordiniPagati)}</strong>
              </div>

              <div className="statBox">
                <span>Ordini in attesa</span>
                <strong>
                  {safeNumber(totals.ordiniInAttesa || pendingOrders.length)}
                </strong>
              </div>

              <div className="statBox">
                <span>Wallet attivi</span>
                <strong>
                  {safeNumber(totals.walletAttivi || wallets.length)}
                </strong>
              </div>

              <div className="statBox">
                <span>Crediti caricati</span>
                <strong>{safeNumber(totals.creditiVenduti)}</strong>
              </div>

              <div className="statBox">
                <span>Crediti usati</span>
                <strong>{safeNumber(totals.creditiUsati)}</strong>
              </div>

              <div className="statBox">
                <span>Crediti residui</span>
                <strong>{safeNumber(totals.creditiResidui)}</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Ordini in attesa</h2>

            {pendingOrders.length === 0 ? (
              <p className="muted">Nessun ordine in attesa.</p>
            ) : (
              <div className="tableWrap">
                <table className="walletTable">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Codice</th>
                      <th>Crediti</th>
                      <th>Importo</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pendingOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.customer_name}</td>
                        <td>
                          <strong>{order.pickup_code}</strong>
                        </td>
                        <td>{safeNumber(order.credits_purchased)}</td>
                        <td>{euro(order.amount_cents)}</td>
                        <td>
                          <div className="inlineActions">
                            <button
                              type="button"
                              onClick={() => approveOrder(order.id)}
                              disabled={actionLoading === order.id}
                            >
                              Approva
                            </button>

                            <button
                              type="button"
                              className="dangerSmallButton"
                              onClick={() => cancelOrder(order.id)}
                              disabled={actionLoading === order.id}
                            >
                              Annulla
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Panoramica wallet</h2>

            {wallets.length === 0 ? (
              <p className="muted">Nessun wallet disponibile.</p>
            ) : (
              <div className="tableWrap">
                <table className="walletTable">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Codice</th>
                      <th>Crediti FREE</th>
                      <th>Crediti ricaricati</th>
                      <th>Saldo</th>
                      <th>Ricariche in attesa</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {wallets.map((wallet) => (
                      <tr key={wallet.pickup_code}>
                        <td>{wallet.customer_name}</td>

                        <td>
                          <strong>{wallet.pickup_code}</strong>
                        </td>

                        <td>{safeNumber(wallet.included_credits_available)}</td>

                        <td>{safeNumber(wallet.paid_credits_available)}</td>

                        <td>
                          <strong>{safeNumber(wallet.credits_available)}</strong>
                        </td>

                        <td>
                          {safeNumber(wallet.pending_credits) > 0 ? (
                            <div className="inlineActions">
                              <span>
                                {safeNumber(wallet.pending_credits)} crediti
                              </span>

                              {wallet.pending_order_id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    approveOrder(
                                      wallet.pending_order_id as string
                                    )
                                  }
                                  disabled={
                                    actionLoading === wallet.pending_order_id
                                  }
                                >
                                  Approva ricarica
                                </button>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="dangerSmallButton"
                            onClick={() => deleteWallet(wallet.pickup_code)}
                            disabled={actionLoading === wallet.pickup_code}
                          >
                            Elimina
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}