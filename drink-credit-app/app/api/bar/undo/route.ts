import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  const body = await request.json();

  const pickupCode = String(body.pickupCode || '').trim().toUpperCase();
  const barPin = String(body.barPin || '');

  if (barPin !== process.env.BAR_PIN) {
    return NextResponse.json({ error: 'PIN bar non valido' }, { status: 401 });
  }

  if (!pickupCode) {
    return NextResponse.json(
      { error: 'Codice cliente obbligatorio' },
      { status: 400 }
    );
  }

  const { data: paidOrders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id,pickup_code,payment_status')
    .eq('pickup_code', pickupCode)
    .eq('payment_status', 'paid');

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  if (!paidOrders || paidOrders.length === 0) {
    return NextResponse.json(
      { error: 'Wallet non trovato o non approvato' },
      { status: 404 }
    );
  }

  const orderIds = paidOrders.map((order) => order.id);

  const { data: lastRedeem, error: lastRedeemError } = await supabaseAdmin
    .from('credit_movements')
    .select('id,order_id,type,amount,drink_id,note')
    .in('order_id', orderIds)
    .in('type', ['redeem', 'redeem_free'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRedeemError) {
    return NextResponse.json(
      { error: lastRedeemError.message },
      { status: 500 }
    );
  }

  if (!lastRedeem) {
    return NextResponse.json(
      { error: 'Nessuno scarico da annullare' },
      { status: 404 }
    );
  }

  const undoType = lastRedeem.type === 'redeem_free' ? 'undo_free' : 'undo';

  const { error: insertError } = await supabaseAdmin
    .from('credit_movements')
    .insert({
      order_id: lastRedeem.order_id,
      type: undoType,
      amount: Math.abs(Number(lastRedeem.amount || 0)),
      drink_id: lastRedeem.drink_id,
      note: `Annullamento: ${lastRedeem.note || 'scarico drink'}`,
      created_by: 'bar',
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}