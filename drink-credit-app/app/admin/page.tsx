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

type WalletSummary = {
  pickup_code: string;
  customer_name: string;
  approved_credits: number;
  pending_credits: number;
  used_credits: number;
  available_credits: number;
  approved_amount_cents: number;
  pending_amount_cents: number;
  created_at: string;
  last_order_at: string;
};

type AdminTotals = {
  wallets_count: number;
  approved_credits: number;
  pending_credits: number;
  used_credits: number;
  available_credits: number;
  approved_amount_cents: number;
  pending_amount_cents: number;
};

function safeNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function euro(cents: number) {
  return `${(safeNumber(cents) / 100).toFixed(0)} €`;
}

export default function AdminPage() {
  const [adminPin, setAdminPin] = useState('');
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [wallets, setWallets] = useState<WalletSummary[]>([]);
  const [totals, setTotals] = useState<AdminTotals>({
    wallets_count: 0,
    approved_credits: 0,
    pending_credits: 0,
    used_credits: 0,
    available_credits: 0,
    approved_amount_cents: 0,
    pending_amount_cents: 0,
  });
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadPendingOrders() {
    const res = await fetch('/api/admin/pending-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminPin }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Errore caricamento ordini');
    }

    setOrders(data.orders || []);
  }

  async function loadStats() {
    const res = await fetch('/api/admin/stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminPin }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Errore caricamento statistiche');
    }

    setWallets(data.wallets || []);
    setTotals({
      wallets_count: safeNumber(data.totals?.wallets_count),
      approved_credits: safeNumber(data.totals?.approved_credits),
      pending_credits: safeNumber(data.totals?.pending_credits),
      used_credits: safeNumber(data.totals?.used_credits),
      available_credits: safeNumber(data.totals?.available_credits),
      approved_amount_cents: safeNumber(data.totals?.approved_amount_cents),
      pending_amount_cents: safeNumber(data.totals?.pending_amount_cents),
    });
  }

  async function loadAdminData() {
    setError('');
    setLoading(true);

    try {
      await loadPendingOrders();
      await loadStats();
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di connessione');
    } finally {
      setLoading(false);
    }
  }

  async function approveOrder(orderId: string) {
    setError('');

    const res = await fetch('/api/admin/approve-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminPin, orderId }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Errore approvazione ordine');
      return;
    }

    await loadAdminData();
  }

  async function cancelOrder(orderId: string) {
    setError('');

    const res = await fetch('/api/admin/cancel-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminPin, orderId }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Errore annullamento ordine');
      return;
    }

    await loadAdminData();
  }

  async function deleteWallet(pickupCode: string) {
    setError('');

    const confirmed = window.confirm(
      `Confermi di eliminare definitivamente il wallet ${pickupCode}?\n\nQuesta operazione eliminerà ordini, ricariche e movimenti collegati.`
    );

    if (!confirmed) {
      return;
    }

    const secondConfirm = window.confirm(
      `Ultima conferma: vuoi davvero eliminare ${pickupCode}?`
    );

    if (!secondConfirm) {
      return;
    }

    const res = await fetch('/api/admin/delete-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminPin, pickupCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Errore eliminazione wallet');
      return;
    }

    await loadAdminData();
  }

  return (
    <main className="container">
      <section className="card">
        <h1>Admin</h1>

        <label>
          PIN admin
          <input
            type="password"
            value={adminPin}
            onChange={(event) => setAdminPin(event.target.value)}
            placeholder="PIN admin"
          />
        </label>

        <button onClick={loadAdminData} disabled={loading}>
          {loading ? 'Caricamento...' : 'Carica pannello admin'}
        </button>

        {error && <p className="error">{error}</p>}
      </section>

      {loaded && (
        <section className="card">
          <h2>Panoramica generale</h2>

          <div className="statsGrid">
            <div className="statBox">
              <span>Wallet creati</span>
              <strong>{safeNumber(totals.wallets_count)}</strong>
            </div>

            <div className="statBox">
              <span>Incassato approvato</span>
              <strong>{euro(totals.approved_amount_cents)}</strong>
            </div>

            <div className="statBox">
              <span>Da approvare</span>
              <strong>{euro(totals.pending_amount_cents)}</strong>
            </div>

            <div className="statBox">
              <span>Crediti disponibili</span>
              <strong>{safeNumber(totals.available_credits)}</strong>
            </div>

            <div className="statBox">
              <span>Crediti usati</span>
              <strong>{safeNumber(totals.used_credits)}</strong>
            </div>

            <div className="statBox">
              <span>Crediti in attesa</span>
              <strong>{safeNumber(totals.pending_credits)}</strong>
            </div>
          </div>
        </section>
      )}

      {loaded && (
        <section className="card">
          <h2>Ordini in attesa</h2>

          {orders.length === 0 ? (
            <p>Nessun ordine in attesa.</p>
          ) : (
            <div className="adminOrders">
              {orders.map((order) => (
                <div key={order.id} className="adminOrder">
                  <div>
                    <strong>{order.customer_name}</strong>
                    <p>Codice: {order.pickup_code}</p>
                    <p>
                      Importo: {euro(order.amount_cents)} - Crediti:{' '}
                      {safeNumber(order.credits_purchased)}
                    </p>
                  </div>

                  <div className="adminActions">
                    <button onClick={() => approveOrder(order.id)}>
                      Approva
                    </button>

                    <button
                      className="dangerButton"
                      onClick={() => cancelOrder(order.id)}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {loaded && (
        <section className="card">
          <h2>Panoramica wallet</h2>

          {wallets.length === 0 ? (
            <p>Nessun wallet creato.</p>
          ) : (
            <div className="walletTableWrapper">
              <table className="walletTable">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Nome</th>
                    <th>Saldo</th>
                    <th>Usati</th>
                    <th>Caricati</th>
                    <th>In attesa</th>
                    <th>Incassato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {wallets.map((wallet) => (
                    <tr key={wallet.pickup_code}>
                      <td>
                        <a href={`/wallet/${wallet.pickup_code}`}>
                          {wallet.pickup_code}
                        </a>
                      </td>
                      <td>{wallet.customer_name}</td>
                      <td>
                        <strong>{safeNumber(wallet.available_credits)}</strong>
                      </td>
                      <td>{safeNumber(wallet.used_credits)}</td>
                      <td>{safeNumber(wallet.approved_credits)}</td>
                      <td>{safeNumber(wallet.pending_credits)}</td>
                      <td>{euro(wallet.approved_amount_cents)}</td>
                      <td>
                        <button
                          className="dangerSmallButton"
                          onClick={() => deleteWallet(wallet.pickup_code)}
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
      )}
    </main>
  );
}