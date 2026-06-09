'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
  const searchParams = useSearchParams();

  const [pickupCode, setPickupCode] = useState('');
  const [barPin, setBarPin] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const scannerRef = useRef<any>(null);

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

  useEffect(() => {
    const codeFromUrl = searchParams.get('code');

    if (codeFromUrl) {
      setPickupCode(codeFromUrl.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  function extractCodeFromQr(decodedText: string) {
    try {
      const url = new URL(decodedText);
      const code = url.searchParams.get('code');

      if (code) {
        return code.trim().toUpperCase();
      }
    } catch {
      // Se non è un URL, uso direttamente il testo letto dal QR.
    }

    return decodedText.trim().toUpperCase();
  }

  async function startScanner() {
    setError('');
    setMessage('');
    setScannerOpen(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      setTimeout(async () => {
        try {
          const scanner = new Html5Qrcode('qr-reader');
          scannerRef.current = scanner;

          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            async (decodedText: string) => {
              const code = extractCodeFromQr(decodedText);

              setPickupCode(code);
              setMessage(`QR letto: ${code}`);

              await stopScanner();

              if (barPin) {
                await searchWalletByCode(code);
              }
            },
            () => {}
          );
        } catch {
          setError(
            'Impossibile aprire la fotocamera. Controlla i permessi del browser.'
          );
          setScannerOpen(false);
        }
      }, 100);
    } catch {
      setError('Errore durante il caricamento dello scanner QR.');
      setScannerOpen(false);
    }
  }

  async function stopScanner() {
    if (!scannerRef.current) {
      setScannerOpen(false);
      return;
    }

    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // Scanner già chiuso.
    }

    scannerRef.current = null;
    setScannerOpen(false);
  }

  async function searchWalletByCode(codeToSearch: string) {
    setError('');
    setMessage('');

    const code = codeToSearch.trim().toUpperCase();

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

  async function searchWallet() {
    await searchWalletByCode(pickupCode);
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

  async function redeemCustomDrink(name: string, credits: number) {
    if (!wallet) {
      return;
    }

    if (wallet.payment_status !== 'paid') {
      setError('Pagamento non ancora approvato');
      return;
    }

    if (wallet.credits_available < credits) {
      setError('Crediti insufficienti');
      return;
    }

    const confirmed = window.confirm(
      `Confermi di scalare ${credits} crediti per ${name}?`
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
        customDrinkName: name,
        customPriceCredits: credits,
        barPin,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Errore scarico drink');
      return;
    }

    setMessage(`Scaricato: ${name} (-${credits} crediti)`);
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
            placeholder="Codice cliente es. AUD-4821"
          />

          <input
            type="password"
            value={barPin}
            onChange={(event) => setBarPin(event.target.value)}
            placeholder="PIN bar"
          />

          <button type="button" onClick={searchWallet}>
            Cerca
          </button>

          <button type="button" onClick={startScanner}>
            Leggi QR
          </button>

          <button
            type="button"
            className="dangerButton"
            onClick={undoLastRedeem}
          >
            Annulla ultimo scarico
          </button>
        </div>

        {scannerOpen && (
          <div className="scannerBox">
            <div id="qr-reader" />

            <button type="button" className="dangerButton" onClick={stopScanner}>
              Chiudi scanner
            </button>
          </div>
        )}

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

          <h3>Free inclusi</h3>

          <div className="barGrid">
            <button
              type="button"
              className="drinkButton freeDrinkButton"
              onClick={() => redeemCustomDrink('BIRRA FREE', 3)}
              disabled={
                wallet.payment_status !== 'paid' || wallet.credits_available < 3
              }
            >
              <span>BIRRA FREE</span>
              <strong>-3</strong>
            </button>

            <button
              type="button"
              className="drinkButton freeDrinkButton"
              onClick={() => redeemCustomDrink('SPRITZ FREE', 5)}
              disabled={
                wallet.payment_status !== 'paid' || wallet.credits_available < 5
              }
            >
              <span>SPRITZ FREE</span>
              <strong>-5</strong>
            </button>
          </div>

          <h3>Scala drink</h3>

          <div className="barGrid">
            {drinks.map((drink) => (
              <button
                key={drink.id}
                type="button"
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