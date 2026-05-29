'use client';

import { useState } from 'react';
import type { CreditPackage } from '@/lib/types';

export default function BuyCredits({ packages }: { packages: CreditPackage[] }) {
  const [customerName, setCustomerName] = useState('');
  const [packageId, setPackageId] = useState(packages[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function checkout() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, packageId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || 'Errore checkout');
    if (!data.checkoutUrl) return setError('Checkout URL non ricevuto da Revolut');
    window.location.href = data.checkoutUrl;
  }

  return (
    <section className="card">
      <h2>Compra crediti</h2>
      <label>Nome o nickname</label>
      <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Es. Marco" />
      <div className="grid" style={{ marginTop: 14 }}>
        {packages.map((p) => (
          <button
            key={p.id}
            className={packageId === p.id ? '' : 'secondary'}
            onClick={() => setPackageId(p.id)}
          >
            <div>{p.name}</div>
            <div>{(p.price_cents / 100).toFixed(0)} €</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <button onClick={checkout} disabled={loading || !customerName || !packageId}>
          {loading ? 'Apro Revolut...' : 'Paga con Revolut'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
