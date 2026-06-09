'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Movement = {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  created_at: string;
  drink_id: string | null;
};

type Wallet = {
  order_id: string;
  customer_name: string;
  pickup_code: string;
  payment_status: string;
  amount_cents: number;
  credits_purchased: number;
  credits_available: number;
  included_credits_available?: number;
  paid_credits_available?: number;
  pending_amount_cents?: number;
  pending_credits?: number;
  created_at: string;
  paid_at: string | null;
};

type WalletResponse = {
  wallet?: Wallet;
  movements?: Movement[];
  error?: string;
};

type CreatedOrder = {
  id: string;
  customer_name: string;
  pickup_code: string;
  amount_cents: number;
  credits_purchased: number;
  payment_status: string;
};

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function euro(cents: unknown) {
  return `${(safeNumber(cents) / 100).toFixed(0)} €`;
}

export default function WalletPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(String(params.code || ''));

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [topUpCredits, setTopUpCredits] = useState(20);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

  const [loading, setLoading] = useState(true);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadWallet() {
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/wallet/${encodeURIComponent(code)}`, {
        cache: 'no-store',
      });

      const data: WalletResponse = await res.json();

      if (!res.ok || !data.wallet) {
        setWallet(null);
        setMovements([]);
        setError(data.error || 'Codice non trovato');
        return;
      }

      setWallet(data.wallet);
      setMovements(data.movements || []);
    } catch {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function topUpWallet(event: React.FormEvent) {
    event.preventDefault();

    if (!wallet) {
      return;
    }

    setError('');
    setCreatedOrder(null);
    setTopUpLoading(true);

    const walletNumber = wallet.pickup_code.split('-')[1];

    try {
      const res = await fetch('/api/manual-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: wallet.customer_name,
          existingWalletNumber: walletNumber,
          credits: topUpCredits,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante la ricarica wallet');
        return;
      }

      setCreatedOrder(data.order);
      await loadWallet();
    } catch {
      setError('Errore di connessione');
    } finally {
      setTopUpLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="card">
          <h1>Caricamento saldo...</h1>
        </div>
      </main>
    );
  }

  if (error && !wallet) {
    return (
      <main className="container">
        <div className="card">
          <h1>Codice non trovato</h1>
          <p>{error}</p>
          <a href="/">Torna alla home</a>
        </div>
      </main>
    );
  }

  if (!wallet) {
    return null;
  }

  const includedCredits = safeNumber(wallet.included_credits_available);
  const paidCredits = safeNumber(wallet.paid_credits_available);
  const totalCredits = safeNumber(wallet.credits_available);
  const walletNumber = wallet.pickup_code.split('-')[1];

  const siteUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || '';

  const walletUrl = `${siteUrl}/wallet/${wallet.pickup_code}`;
  const barQrUrl = `${siteUrl}/bar?code=${wallet.pickup_code}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    barQrUrl
  )}`;

  const whatsappText = encodeURIComponent(
    `🍸 FESTA AUDACE\n` +
      `Il mio codice wallet è ${wallet.pickup_code}\n` +
      `Numero wallet: ${walletNumber}\n\n` +
      `Link saldo:\n${walletUrl}\n\n` +
      `QR code da mostrare al bar:\n${qrImageUrl}`
  );

  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  return (
    <main className="container">
      <section className="card">
        <h1>Il tuo saldo</h1>

        <p>
          <strong>Nome:</strong> {wallet.customer_name}
        </p>

        <p>
          <strong>Codice:</strong> {wallet.pickup_code}
        </p>

        <p>
          <strong>Stato pagamento:</strong>{' '}
          {wallet.payment_status === 'paid'
            ? 'Pagato'
            : 'In attesa di approvazione'}
        </p>

        <div className="statsGrid">
          <div className="statBox">
            <span>Crediti FREE</span>
            <strong>{includedCredits}</strong>
          </div>

          <div className="statBox">
            <span>Crediti ricaricati</span>
            <strong>{paidCredits}</strong>
          </div>

          <div className="statBox">
            <span>Totale wallet</span>
            <strong>{totalCredits}</strong>
          </div>
        </div>

        {!!wallet.pending_credits && wallet.pending_credits > 0 && (
          <p className="muted">
            Ricarica in attesa: {wallet.pending_credits} crediti
          </p>
        )}

        <div className="qrBox">
          <img src={qrImageUrl} alt={`QR wallet ${wallet.pickup_code}`} />
          <p>Mostra questo QR al bar</p>
        </div>

        <div className="inlineActions">
          <a
            className="whatsappButton"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Salvami il codice su WhatsApp
          </a>

          <a className="actionLink" href="/">
            Torna alla home
          </a>
        </div>
      </section>

      <section className="card">
        <h2>Ricarica questo wallet</h2>

        <form onSubmit={topUpWallet}>
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
            <strong>
              {Number.isFinite(topUpCredits) ? topUpCredits : 0} €
            </strong>
          </p>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={topUpLoading}>
            {topUpLoading ? 'Creazione ricarica...' : 'Ricarica wallet'}
          </button>
        </form>

        {createdOrder && (
          <div className="createdWalletBox">
            <p className="success">
              Ricarica creata: <strong>{createdOrder.credits_purchased}</strong>{' '}
              crediti
            </p>

            <p>
              Invia <strong>{euro(createdOrder.amount_cents)}</strong> tramite
              Revolut o PayPal. Dopo il pagamento, un admin controllerà e
              attiverà i tuoi crediti.
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
          </div>
        )}
      </section>

      <section className="card">
        <h2>Movimenti</h2>

        {movements.length === 0 ? (
          <p>Nessun movimento disponibile.</p>
        ) : (
          <ul>
            {movements.map((movement) => (
              <li key={movement.id}>
                <strong>
                  {movement.amount > 0 ? '+' : ''}
                  {movement.amount} crediti
                </strong>{' '}
                - {movement.note || movement.type}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}