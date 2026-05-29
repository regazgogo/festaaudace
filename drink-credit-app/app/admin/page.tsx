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

function euro(cents: number) {
  return `${(cents / 100).toFixed(0)} €`;
}

export default function AdminPage() {
  const [adminPin, setAdminPin] = useState('');
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadPendingOrders() {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/pending-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore caricamento ordini');
        return;
      }

      setOrders(data.orders || []);
      setLoaded(true);
    } catch {
      setError('Errore di connessione');
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

    await loadPendingOrders();
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

    await loadPendingOrders();
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

        <button onClick={loadPendingOrders} disabled={loading}>
          {loading ? 'Caricamento...' : 'Carica ordini in attesa'}
        </button>

        {error && <p className="error">{error}</p>}
      </section>

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
                      {order.credits_purchased}
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
    </main>
  );
}