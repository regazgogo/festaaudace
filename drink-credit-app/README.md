# Drink Credit App

Mini-app per festa con crediti digitali, Revolut Hosted Checkout e pannello bar.

## Setup rapido

1. Crea un progetto Supabase.
2. Esegui `supabase/schema.sql` nel SQL editor di Supabase.
3. Copia `.env.example` in `.env.local` e compila le variabili.
4. Installa dipendenze: `npm install`.
5. Avvia: `npm run dev`.
6. Deploy su Vercel e inserisci le stesse variabili ambiente.
7. In Revolut Business configura il webhook su:
   `https://TUO-DOMINIO/api/revolut/webhook`

## Pagine

- `/` pacchetti credito e checkout
- `/success?code=...` conferma e QR wallet
- `/wallet/[code]` saldo cliente
- `/bar` pannello bar per scalare crediti
- `/admin` statistiche base

## Nota integrazione Revolut

Il codice crea un ordine via Merchant API e usa `checkout_url` restituito da Revolut.
La conferma dei crediti avviene solo dal webhook `ORDER_COMPLETED`.
