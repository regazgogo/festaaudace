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

export async function POST(request: Request) {
  const body = await request.json();

  const adminPin = String(body.adminPin || '');
  const customerName = String(body.customerName || '').trim();
  const walletType = String(body.walletType || '');

  if (adminPin !== process.env.ADMIN_PIN) {
    return NextResponse.json(
      { error: 'PIN admin non valido' },
      { status: 401 }
    );
  }

  if (!customerName) {
    return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 });
  }

  if (!['giornata_intera', 'post_cena'].includes(walletType)) {
    return NextResponse.json(
      { error: 'Tipo wallet non valido' },
      { status: 400 }
    );
  }

  const credits = walletType === 'giornata_intera' ? 20 : 5;

  const note =
    walletType === 'giornata_intera'
      ? 'Wallet Giornata Intera - 20 crediti FREE inclusi'
      : 'Wallet Post Cena - 5 crediti FREE inclusi';

  let pickupCode = generatePickupCode(customerName);

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

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      customer_name: customerName,
      pickup_code: pickupCode,
      package_id: null,
      amount_cents: 0,
      credits_purchased: credits,
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .select(
      'id,customer_name,pickup_code,amount_cents,credits_purchased,payment_status,created_at'
    )
    .single();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  const { error: movementError } = await supabaseAdmin
    .from('credit_movements')
    .insert({
      order_id: order.id,
      type: 'included',
      amount: credits,
      note,
      created_by: 'admin',
    });

  if (movementError) {
    return NextResponse.json({ error: movementError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    order,
    walletType,
  });
}