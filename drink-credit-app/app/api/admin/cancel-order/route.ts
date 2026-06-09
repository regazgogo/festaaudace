import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushoverNotification } from '@/lib/pushover';

export async function POST(request: Request) {
  const body = await request.json();

  const adminPin = String(body.adminPin || '');
  const orderId = String(body.orderId || '');

  if (adminPin !== process.env.ADMIN_PIN) {
    return NextResponse.json(
      { error: 'PIN admin non valido' },
      { status: 401 }
    );
  }

  if (!orderId) {
    return NextResponse.json(
      { error: 'ID ordine mancante' },
      { status: 400 }
    );
  }

  const { data: order, error: orderReadError } = await supabaseAdmin
    .from('orders')
    .select(
      'id,customer_name,pickup_code,payment_status,amount_cents,credits_purchased'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (orderReadError) {
    return NextResponse.json({ error: orderReadError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });
  }

  if (order.payment_status !== 'pending') {
    return NextResponse.json(
      { error: 'Ordine già gestito o non in attesa' },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      payment_status: 'cancelled',
    })
    .eq('id', orderId)
    .eq('payment_status', 'pending');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await sendPushoverNotification({
    title: 'FESTA AUDACE - Ordine annullato',
    message:
      `Ordine/ricarica annullato\n` +
      `Nome: ${order.customer_name}\n` +
      `Codice: ${order.pickup_code}\n` +
      `Crediti: ${order.credits_purchased}\n` +
      `Importo: ${(Number(order.amount_cents || 0) / 100).toFixed(0)} €`,
    priority: 0,
  });

  return NextResponse.json({
    ok: true,
    orderId,
  });
}