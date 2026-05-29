'use client';

import { useEffect, useState } from 'react';

type Drink = {
  id: string;
  name: string;
  price_credits: number;
  category: string | null;
};

type CreatedOrder = {
  id: string;
  customer_name: string;
  pickup_code: string;
  amount_cents: number;
  credits_purchased: number;
  payment_status: string;
};

function euro(cents: number) {
  return `${(cents / 100).toFixed(0)} €`;
}

export default function HomePage() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [credits, setCredits] = useState(20);
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      const res = await fetch('/api/public-data', { cache: 'no-store' });
      const data = await res.json();

      if (data.drinks) {
        setDrinks(data.drinks);
      }
    }

    loadData();
  }, []);

  async function createOrder(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/manual-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName,
          credits,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante la creazione ordine');
        return;
      }

      setOrder(data.order);
    } catch {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  }

  if (order) {
    return (
      <main className="container">
        <section className="card">
          <h1>Pagamento in attesa</h1>

          <p>
            Invia <strong>{euro(order.amount_cents)}</strong> tramite Revolut o
            PayPal.
          </p>

          <p>
            Dopo il pagamento, un admin controllerà e attiverà i tuoi crediti.
          </p>

          <p>Il tuo codice cliente è:</p>

          <div className="codeBox">{order.pickup_code}</div>

          <div className="paymentButtons">
            <a
              className="paymentButton"
              href="https://revolut.me/albertofrn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/revolut-logo.svg" alt="Revolut" />
            </a>

            <a
              className="paymentButton"
              href="https://paypal.me/AFornari"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/paypal-logo.svg" alt="PayPal" />
            </a>
          </div>

          <p>
            Quando il pagamento viene approvato, potrai usare i crediti al bar.
          </p>

          <p>
            <a href={`/wallet/${order.pickup_code}`}>Controlla il tuo saldo</a>
          </p>

          <button onClick={() => setOrder(null)}>Crea un altro ordine</button>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="hero">
        <h1>Drink Credits</h1>
        <p>
          Compra crediti drink, paga con Revolut o PayPal e mostra il codice al
          bar.
        </p>
      </section>

      <section className="card">
        <h2>Compra crediti</h2>

        <form onSubmit={createOrder}>
          <label>
            Nome
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Es. Alberto"
              required
            />
          </label>

          <label>
            Crediti da caricare
            <input
              type="number"
              min="1"
              max="200"
              step="1"
              value={credits}
              onChange={(event) => setCredits(Number(event.target.value))}
              required
            />
          </label>

          <p>
            Totale da pagare:{' '}
            <strong>{Number.isFinite(credits) ? credits : 0} €</strong>
          </p>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Creazione...' : 'Crea ordine'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Menu drink</h2>

        <div className="drinkGrid">
          {drinks.map((drink) => (
            <div key={drink.id} className="drinkItem">
              <span>{drink.name}</span>
              <strong>{drink.price_credits} crediti</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}