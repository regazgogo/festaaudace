import Link from 'next/link';

export default function Success({ searchParams }: { searchParams: { code?: string } }) {
  const code = searchParams.code || '';
  return (
    <main>
      <section className="card">
        <h1>Pagamento in elaborazione ✅</h1>
        <p className="muted">Appena Revolut conferma il pagamento tramite webhook, i crediti saranno disponibili.</p>
        {code && <div className="big-code">{code}</div>}
        {code && <Link href={`/wallet/${encodeURIComponent(code)}`}><button>Vedi saldo crediti</button></Link>}
      </section>
    </main>
  );
}
