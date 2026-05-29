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
          {wallet.payment_status === 'paid' ? 'Pagato' : wallet.payment_status}
        </p>

        <div className="balanceBox">
          <span>Crediti disponibili</span>
          <strong>{wallet.credits_available}</strong>
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
                <strong>{movement.amount > 0 ? '+' : ''}
                  {movement.amount} crediti</strong>{' '}
                — {movement.note || movement.type}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}