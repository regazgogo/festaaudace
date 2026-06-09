'use client';

import { useState } from 'react';

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
  pending_credits?: number;
  pending_amount_cents?: number;
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

export default function AdminPage() {
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
    setLoading(true);

    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPin }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Errore caricamento admin');
        setLoaded(false);
        return;
      }

      setData(json);
      setLoaded(true);
    } catch {
      setError('Errore di connessione');
      setLoaded(false);
    } finally {
      setLoading(false);
    }
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

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Errore creazione wallet');
        return;
      }

      setCreatedWalletCode(json.order.pickup_code);
      setMessage(`Wallet creato: ${json.order.pickup_code}`);
      setNewWalletName('');
      setNewWalletType('giornata_intera');

      await loadAdminData();
    } catch {
      setError('Errore di connessione');
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

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Errore approvazione ordine');
        return;
      }

      setMessage('Ordine approvato');
      await loadAdminData();
    } catch {
      setError('Errore di connessione');
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

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Errore annullamento ordine');
        return;
      }

      setMessage('Ordine annullato');
      await loadAdminData();
    } catch {
      setError('Errore di connessione');
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

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Errore eliminazione wallet');
        return;
      }

      setMessage(`Wallet eliminato: ${pickupCode}`);
      await loadAdminData();
    } catch {
      setError('Errore di connessione');
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
            value={adminPin}
            onChange={(event) => setAdminPin(event.target.value)}
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
                    Giornata Intera - 20 crediti
                  </option>
                  <option value="post_cena">Post Cena - 5 crediti</option>
                </select>
              </label>

              <button type="submit" disabled={creatingWallet}>
                {creatingWallet ? 'Creazione...' : 'Crea wallet'}
              </button>
            </form>

            {createdWalletCode && (
              <p className="success">
                Wallet creato: <strong>{createdWalletCode}</strong>
              </p>
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
                      <th>Crediti caricati</th>
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
                        <td>{safeNumber(wallet.credits_purchased)}</td>
                        <td>
                          <strong>{safeNumber(wallet.credits_available)}</strong>
                        </td>
                        <td>
                          {safeNumber(wallet.pending_credits) > 0
                            ? `${safeNumber(wallet.pending_credits)} crediti`
                            : '-'}
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