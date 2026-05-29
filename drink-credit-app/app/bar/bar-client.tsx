'use client';

import { useEffect, useState } from 'react';

type Wallet = {
  order_id: string;
  customer_name: string;
  pickup_code: string;
  payment_status: string;
  credits_available: number;
};

type Drink = {
  id: string;
  name: string;
  price_credits: number;
  category: string | null;
};

export default function BarClient() {
  const [pickupCode, setPickupCode] = useState('');
  const [barPin, setBarPin] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadDrinks() {
      const res = await fetch('/api/public-data', { cache: 'no-store' });
      const data = await res.json();

      if (data.drinks) {
        setDrinks(data.drinks);
      }
    }

    loadDrinks();
  }, []);

  async function searchWallet() {
    setError('');
    setMessage('');

    const code = pickupCode.trim().toUpperCase();

    if (!code) {
      setError('Inserisci un codice cliente');
      return;
    }

    const res = await fetch(`/api/wallet/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });

    const data = await res.json();

    if (!res.ok || !data.wallet) {
      setWallet(null);
      setError(data.error || 'Codice non trovato');
      return;
    }

    setWallet(data.wallet);
  }

  async function redeemDrink(drink: Drink) {
    if (!wallet) {
      return;
    }

    if (wallet.payment_status !== 'paid') {
      setError('Pagamento non ancora approvato');
      return;
    }

    if (wallet.credits_available < drink.price_credits) {
      setError('Crediti insufficienti');
      return;
    }

    const confirmed = window.confirm(
      `Confermi di scalare ${drink.price_credits} crediti per ${drink.name}?`
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');

    const res = await fetch('/api/bar/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickupCode: wallet.pickup_code,
        drinkId: drink.id,
        barPin,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Errore scarico drink');
      return;
    }

    setMessage(`Scaricato: ${drink.name} (-${drink.price_credits} crediti)`);
    await searchWallet();
  }

  async function undoLastRedeem() {
    if (!wallet) {
      setError('Cerca prima un cliente');
      return;
    }

    const confirmed = window.confirm(
      `Confermi di annullare l'ultimo scarico per ${wallet.pickup_code}?`
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');

    const res = await fetch('/api/bar/undo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickupCode: wallet.pickup_code,
        barPin,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Errore annullamento');
      return;
    }

    setMessage('Ultimo scarico annullato');
    await searchWallet();
  }

  return (
    <main className="container">
      <section className="card">
        <h1>Pannello Bar 🍸</h1>

        <div className="inlineActions">
          <input
            value={pickupCode}
            onChange={(event) => setPickupCode(event.target.value)}
            placeholder="Codice cliente es. MRC-4821"
          />

          <input
            type="password"
            value={barPin}
            onChange={(event) => setBarPin(event.target.value)}
            placeholder="PIN bar"
          />

          <button onClick={searchWallet}>Cerca</button>

          <button className="dangerButton" onClick={undoLastRedeem}>
            Annulla ultimo scarico
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
      </section>

      {wallet && (
        <section className="card">
          <h2>{wallet.customer_name}</h2>

          <p>
            Codice: <strong>{wallet.pickup_code}</strong>
          </p>

          <p>
            Stato:{' '}
            <strong>
              {wallet.payment_status === 'paid'
                ? 'Pagato'
                : 'In attesa di approvazione'}
            </strong>
          </p>

          <div className="balanceBox">
            <span>Crediti disponibili</span>
            <strong>{wallet.credits_available}</strong>
          </div>

          <h3>Scala drink</h3>

          <div className="barGrid">
            {drinks.map((drink) => (
              <button
                key={drink.id}
                className="drinkButton"
                onClick={() => redeemDrink(drink)}
                disabled={
                  wallet.payment_status !== 'paid' ||
                  wallet.credits_available < drink.price_credits
                }
              >
                <span>{drink.name}</span>
                <strong>-{drink.price_credits}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}