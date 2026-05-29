type Movement = {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  created_at: string;
  drink_id: string | null;
};

type WalletResponse = {
  wallet?: {
    order_id: string;
    customer_name: string;
    pickup_code: string;
    payment_status: string;
    amount_cents: number;
    credits_purchased: number;
    credits_available: number;
    pending_amount_cents?: number;
    pending_credits?: number;
    created_at: string;
    paid_at: string | null;
  };
  movements?: Movement[];
  error?: string;
};

async function getWallet(code: string): Promise<WalletResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const res = await fetch(`${baseUrl}/api/wallet/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });

  const data = await res.json();

  if (!res.ok) {
    return { error: data.error || 'Codice non trovato' };
  }

  return data;
}

export default async function WalletPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getWallet(code);

  if (data.error || !data.wallet) {
    return (
      <main className="container">
        <div className="card">
          <h1>Codice non trovato</h1>
          <p>Controlla il codice oppure torna alla home.</p>
          <a href="/">Torna alla home</a>
        </div>
      </main>
    );
  }

  const wallet = data.wallet;
  const movements = data.movements || [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const barQrUrl = `${siteUrl}/bar?code=${wallet.pickup_code}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    barQrUrl
  )}`;

  return (
    <main className="container">
      <div className="card">
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

        <div className="balanceBox">
          <span>Crediti disponibili</span>
          <strong>{wallet.credits_available}</strong>
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

        <p>
          <a href="/">Torna alla home</a>
        </p>
      </div>

      <div className="card">
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
      </div>
    </main>
  );
}