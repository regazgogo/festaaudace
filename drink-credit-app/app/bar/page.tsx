import { Suspense } from 'react';
import BarClient from './bar-client';

export default function BarPage() {
  return (
    <Suspense fallback={<BarFallback />}>
      <BarClient />
    </Suspense>
  );
}

function BarFallback() {
  return (
    <main className="container">
      <section className="card">
        <h1>Pannello Bar 🍸</h1>
        <p>Caricamento...</p>
      </section>
    </main>
  );
}