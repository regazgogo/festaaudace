'use client';

import { useState } from 'react';

const DRINKS = [
  { name: 'Gin Tonic Premium', credits: 5 },
  { name: 'Vodka Redbull', credits: 4 },
  { name: 'Mojito', credits: 4 },
  { name: 'Cuba Libre', credits: 4 },
  { name: 'Gin Tonic', credits: 3 },
  { name: 'Gin Lemon', credits: 3 },
  { name: 'Coca Monte', credits: 3 },
  { name: 'Spritz Aperol', credits: 3 },
  { name: 'Spritz Campari', credits: 3 },
  { name: 'Campari Orange', credits: 3 },
  { name: 'Aperol Cedrata', credits: 3 },
  { name: 'Amari', credits: 2 },
  { name: 'Chupito', credits: 1 },
];

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
  const [existingName, setExistingName] = useState('');
  const [existingWalletNumber, setExistingWalletNumber] = useState('');
  const [error, setError] = useState('');

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

  return (
    <main className="container">
      <section className="hero">
        <h1>FESTA AUDACE</h1>
        <p>Ricarica o visualizza il tuo saldo.</p>
      </section>

      <section className="card">
        <h2>Ricarica/visualizza il tuo saldo</h2>

        <form onSubmit={openExistingWallet}>
          <label>
            Nome usato per creare il wallet
            <input
              value={existingName}
              onChange={(event) => setExistingName(event.target.value)}
              placeholder="Es. Audax"
              required
            />
          </label>

          <label>
            Numero wallet
            <input
              value={existingWalletNumber}
              onChange={(event) =>
                setExistingWalletNumber(
                  event.target.value.replace(/[^0-9]/g, '')
                )
              }
              placeholder="Es. 4821"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              required
            />
          </label>

          <p className="muted">
            Esempio: Audax + 4821 apre il wallet AUD-4821.
          </p>

          {error && <p className="error">{error}</p>}

          <button type="submit">Apri saldo</button>
        </form>
      </section>

      <section className="card">
        <h2>Lista drink</h2>

        <div className="drinkList">
          {DRINKS.map((drink) => (
            <div className="drinkListItem" key={drink.name}>
              <span>{drink.name}</span>
              <strong>{drink.credits} crediti</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}