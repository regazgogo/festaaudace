import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function generatePickupCode(name: string) {
  const cleanName = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');

  const random = Math.floor(1000 + Math.random() * 9000);

  return `${cleanName}-${random}`;
}

function buildPickupCode(name: string, walletNumber: string) {
  const cleanName = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');

  const cleanNumber = walletNumber.trim().replace(/[^0-9]/g, '');

  return `${cleanName}-${cleanNumber}`;
}

export async function POST(request: Request) {
  const body = await request.json();

  const customerName = String(body.customerName || '').trim();
  const credits = Number(body.credits || 0);
  const existingWalletNumber = String(body.existingWalletNumber || '').trim();

  if (!customerName) {
    return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 });
  }

  if (!Number.isInteger(credits) || credits < 1 || credits > 200) {
    return NextResponse.json(
      { error: 'Inserisci un numero di crediti valido da 1 a 200' },
      { status: 400 }
    );
  }

  const amountCents = credits * 100;

  let pickupCode = '';

  if (existingWalletNumber) {
    const cleanNumber = existingWalletNumber.replace(/[^0-9]/g, '');

    if (cleanNumber.length !== 4) {
      return NextResponse.json(
        { error: 'Il numero wallet deve avere 4 cifre' },
        { status: 400 }
      );
    }

    pickupCode = buildPickupCode(customerName, cleanNumber);

    const { data: existingWallet, error: existingWalletError } =
      await supabaseAdmin
        .from('orders')
        .select('id,pickup_code,payment_status')
        .eq('pickup_code', pickupCode)
        .eq('payment_status', 'paid')
        .limit(1)
        .maybeSingle();

    if (existingWalletError) {
      return NextResponse.json(
        { error: existingWalletError.message },
        { status: 500 }
      );
    }

    if (!existingWallet) {
      return NextResponse.json(
        { error: 'Wallet non trovato o non ancora approvato' },
        { status: 404 }
      );
    }
  } else {
    pickupCode = generatePickupCode(customerName);

    for (let i = 0; i < 10; i++) {
      const { data: existing } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('pickup_code', pickupCode)
        .maybeSingle();

      if (!existing) {
        break;
      }

      pickupCode = generatePickupCode(customerName);
    }
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      customer_name: customerName,
      pickup_code: pickupCode,
      package_id: null,
      amount_cents: amountCents,
      credits_purchased: credits,
      payment_status: 'pending',
    })
    .select(
      'id,customer_name,pickup_code,amount_cents,credits_purchased,payment_status,created_at'
    )
    .single();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  return NextResponse.json({
    order,
    paymentInstructions: {
      amount: credits,
      revolutUrl: 'https://revolut.me/albertofrn',
      paypalUrl: 'https://paypal.me/AFornari',
      message: `Invia ${credits} € tramite Revolut o PayPal. I crediti saranno attivati appena un admin conferma il pagamento.`,
    },
  });
}