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

type Mode = 'choice' | 'new' | 'existing';

function euro(cents: number) {
  return `${(cents / 100).toFixed(0)} €`;
}

function buildAudaceCode(name: string, walletNumber: string) {
  const cleanName = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');

  const cleanNumber = walletNumber.trim().replace(/[^0-9]/g, '');

  return `${cleanName}-${cleanNumber}`;
}

export default function HomePage() {
  const [mode, setMode] = useState<Mode>('choice');
  const [drinks, setDrinks] = useState<Drink[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [credits, setCredits] = useState(20);

  const [existingName, setExistingName] = useState('');
  const [existingWalletNumber, setExistingWalletNumber] = useState('');
  const [topUpCredits, setTopUpCredits] = useState(20);

  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [orderType, setOrderType] = useState<'new' | 'topup'>('new');

  const [loading, setLoading] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState(false);
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

      setOrderType('new');
      setOrder(data.order);
    } catch {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  }

  function openExistingWallet(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const cleanNumber = existingWalletNumber.trim().replace(/[^0-9]/g, '');

    if (!existingName.trim()) {
      setError('Inserisci il nome');
      return;
    }

    if (!cleanNumber || cleanNumber.length !== 4) {
      setError('Inserisci il numero wallet di 4 cifre');
      return;
    }

    const code = buildAudaceCode(existingName, cleanNumber);

    window.location.href = `/wallet/${encodeURIComponent(code)}`;
  }

  async function topUpExistingWallet(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setTopUpLoading(true);

    const cleanNumber = existingWalletNumber.trim().replace(/[^0-9]/g, '');

    if (!existingName.trim()) {
      setError('Inserisci il nome');
      setTopUpLoading(false);
      return;
    }

    if (!cleanNumber || cleanNumber.length !== 4) {
      setError('Inserisci il numero wallet di 4 cifre');
      setTopUpLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/manual-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: existingName,
          existingWalletNumber: cleanNumber,
          credits: topUpCredits,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante la ricarica wallet');
        return;
      }

      setOrderType('topup');
      setOrder(data.order);
    } catch {
      setError('Errore di connessione');
    } finally {
      setTopUpLoading(false);
    }
  }

  if (order) {
    const walletNumber = order.pickup_code.split('-')[1];
    const walletUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/wallet/${order.pickup_code}`
        : `/wallet/${order.pickup_code}`;

    const whatsappText = encodeURIComponent(
      `🍸 Festa Audace\n` +
        `Il mio codice wallet è ${order.pickup_code}\n` +
        `Numero wallet: ${walletNumber}\n` +
        `Link saldo: ${walletUrl}`
    );

    const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

    return (
      <main className="container">
        <section className="card">
          <h1>
            {orderType === 'topup'
              ? 'Ricarica in attesa'
              : 'Pagamento in attesa'}
          </h1>

          <p>
            Invia <strong>{euro(order.amount_cents)}</strong> tramite Revolut o
            PayPal.
          </p>

          <p>
            Dopo il pagamento, un admin controllerà e attiverà i tuoi crediti.
          </p>

          <p>Il tuo codice Audace è:</p>

          <div className="codeBox">{order.pickup_code}</div>

          <p>
            Ricordati soprattutto il numero wallet:{' '}
            <strong>{walletNumber}</strong>
          </p>

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

          <div className="inlineActions">
            <a className="actionLink" href={`/wallet/${order.pickup_code}`}>
              Controlla il tuo saldo
            </a>

            <a
              className="whatsappButton"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Salvami il codice su WhatsApp
            </a>
          </div>

          <button
            type="button"
            onClick={() => {
              setOrder(null);
              setMode('choice');
              setCustomerName('');
              setCredits(20);
              setError('');
            }}
          >
            Torna alla home
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="hero">
        <h1>Drink Credits</h1>
        <p>
          Carica crediti, paga con Revolut o PayPal e mostra il codice Audace al
          bar.
        </p>
      </section>

      {mode === 'choice' && (
        <section className="card">
          <h2>Che Audace sei?</h2>

          <div className="choiceGrid">
            <button
              type="button"
              className="choiceButton"
              onClick={() => {
                setError('');
                setMode('new');
              }}
            >
              <strong>Nuovo Audace</strong>
              <span>Creo un nuovo wallet e carico crediti</span>
            </button>

            <button
              type="button"
              className="choiceButton"
              onClick={() => {
                setError('');
                setMode('existing');
              }}
            >
              <strong>Audace già bevuto</strong>
              <span>Ho già un wallet e voglio vedere o ricaricare il saldo</span>
            </button>
          </div>
        </section>
      )}

      {mode === 'new' && (
        <section className="card">
          <h2>Nuovo Audace</h2>

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

            <div className="inlineActions">
              <button type="submit" disabled={loading}>
                {loading ? 'Creazione...' : 'Crea wallet'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('choice');
                }}
              >
                Indietro
              </button>
            </div>
          </form>
        </section>
      )}

      {mode === 'existing' && (
        <section className="card">
          <h2>Audace già bevuto</h2>

          <form onSubmit={openExistingWallet}>
            <label>
              Nome usato per creare il wallet
              <input
                value={existingName}
                onChange={(event) => setExistingName(event.target.value)}
                placeholder="Es. Alberto"
                required
              />
            </label>

            <label>
              Numero wallet
              <input
                value={existingWalletNumber}
                onChange={(event) => setExistingWalletNumber(event.target.value)}
                placeholder="Es. 4821"
                inputMode="numeric"
                maxLength={4}
                required
              />
            </label>

            <p className="muted">
              Esempio: Alberto + 4821 apre il wallet ALB-4821.
            </p>

            {error && <p className="error">{error}</p>}

            <div className="inlineActions">
              <button type="submit">Apri saldo</button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('choice');
                }}
              >
                Indietro
              </button>
            </div>
          </form>

          <hr className="sectionDivider" />

          <h3>Ricarica questo wallet</h3>

          <form onSubmit={topUpExistingWallet}>
            <label>
              Crediti da aggiungere
              <input
                type="number"
                min="1"
                max="200"
                step="1"
                value={topUpCredits}
                onChange={(event) => setTopUpCredits(Number(event.target.value))}
                required
              />
            </label>

            <p>
              Totale ricarica:{' '}
              <strong>{Number.isFinite(topUpCredits) ? topUpCredits : 0} €</strong>
            </p>

            <button type="submit" disabled={topUpLoading}>
              {topUpLoading ? 'Creazione ricarica...' : 'Ricarica wallet'}
            </button>
          </form>
        </section>
      )}

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