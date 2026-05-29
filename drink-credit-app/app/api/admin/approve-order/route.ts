import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
      { error: 'Ordine mancante' },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id,credits_purchased,payment_status')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json(
      { error: 'Ordine non trovato' },
      { status: 404 }
    );
  }

  if (order.payment_status === 'paid') {
    return NextResponse.json({ ok: true });
  }

  if (order.payment_status !== 'pending') {
    return NextResponse.json(
      { error: 'Questo ordine non è più in attesa' },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: existingMovement } = await supabaseAdmin
    .from('credit_movements')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', 'purchase')
    .maybeSingle();

  if (!existingMovement) {
    const { error: movementError } = await supabaseAdmin
      .from('credit_movements')
      .insert({
        order_id: orderId,
        type: 'purchase',
        amount: order.credits_purchased,
        note: 'Pagamento approvato manualmente',
        created_by: 'admin',
      });

    if (movementError) {
      return NextResponse.json(
        { error: movementError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}