'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

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
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [drinks, setDrinks] = useState<Drink[]>([]);

  const [existingName, setExistingName] = useState('');
  const [existingWalletNumber, setExistingWalletNumber] = useState('');
  const [topUpCredits, setTopUpCredits] = useState(20);

  const [order, setOrder] = useState<CreatedOrder | null>(null);
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

      setOrder(data.order);
    } catch {
      setError('Errore di connessione');
    } finally {
      setTopUpLoading(false);
    }
  }

  if (order) {
    const walletNumber = order.pickup_code.split('-')[1];

    const siteUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || '';

    const walletUrl = `${siteUrl}/wallet/${order.pickup_code}`;
    const barQrUrl = `${siteUrl}/bar?code=${order.pickup_code}`;

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
      barQrUrl
    )}`;

    const whatsappText = encodeURIComponent(
      `🍸 FESTA AUDACE\n` +
        `Il mio codice wallet è ${order.pickup_code}\n` +
        `Numero wallet: ${walletNumber}\n\n` +
        `Link saldo:\n${walletUrl}\n\n` +
        `QR code da mostrare al bar:\n${qrImageUrl}`
    );

    const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

    async function shareQrPng() {
      const canvas = qrCanvasRef.current;

      if (!canvas) {
        alert('QR non ancora pronto');
        return;
      }

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Impossibile creare il PNG del QR');
          return;
        }

        const file = new File([blob], `festa-audace-${order.pickup_code}.png`, {
          type: 'image/png',
        });

        const shareData = {
          title: 'FESTA AUDACE - QR Wallet',
          text: `QR wallet ${order.pickup_code}`,
          files: [file],
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `festa-audace-${order.pickup_code}.png`;
        link.click();

        URL.revokeObjectURL(url);
      }, 'image/png');
    }

    return (
      <main className="container">
        <section className="card">
          <h1>Ricarica in attesa</h1>

          <p>
            Invia <strong>{euro(order.amount_cents)}</strong> tramite Revolut o
            PayPal.
          </p>

          <p>
            Dopo il pagamento, un admin controllerà e attiverà i tuoi crediti.
          </p>

          <p>Il tuo codice Audace è:</p>

          <div className="codeBox">{order.pickup_code}</div>

          <div className="qrBox">
            <QRCodeCanvas
              ref={qrCanvasRef}
              value={barQrUrl}
              size={220}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
              includeMargin
            />

            <p>Mostra questo QR al bar</p>

            <button type="button" onClick={shareQrPng}>
              Condividi QR PNG
            </button>
          </div>

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
              setExistingName('');
              setExistingWalletNumber('');
              setTopUpCredits(20);
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
        <h1>FESTA AUDACE</h1>
        <p>
          Apri il tuo wallet, controlla il saldo o ricarica i crediti drink.
        </p>
      </section>

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
            <strong>
              {Number.isFinite(topUpCredits) ? topUpCredits : 0} €
            </strong>
          </p>

          <button type="submit" disabled={topUpLoading}>
            {topUpLoading ? 'Creazione ricarica...' : 'Ricarica wallet'}
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