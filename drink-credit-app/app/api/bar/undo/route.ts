import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type MovementRow = {
  id: string;
  order_id: string;
  type: string;
  amount: number;
  drink_id: string | null;
  note: string | null;
  created_at: string;
};

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

  const { data: movements, error: movementsError } = await supabaseAdmin
    .from('credit_movements')
    .select('id,order_id,type,amount,drink_id,note,created_at')
    .in('order_id', orderIds)
    .in('type', ['redeem', 'redeem_free', 'undo', 'undo_free'])
    .order('created_at', { ascending: false });

  if (movementsError) {
    return NextResponse.json(
      { error: movementsError.message },
      { status: 500 }
    );
  }

  const allMovements = (movements || []) as MovementRow[];

  const alreadyUndoneMovementIds = new Set<string>();

  for (const movement of allMovements) {
    if (movement.type !== 'undo' && movement.type !== 'undo_free') {
      continue;
    }

    const match = String(movement.note || '').match(/UNDO_OF:([0-9a-f-]+)/i);

    if (match?.[1]) {
      alreadyUndoneMovementIds.add(match[1]);
    }
  }

  const lastRedeemToUndo = allMovements.find((movement) => {
    const isRedeem =
      movement.type === 'redeem' || movement.type === 'redeem_free';

    if (!isRedeem) {
      return false;
    }

    return !alreadyUndoneMovementIds.has(movement.id);
  });

  if (!lastRedeemToUndo) {
    return NextResponse.json(
      { error: 'Nessuno scarico da annullare' },
      { status: 404 }
    );
  }

  const undoType =
    lastRedeemToUndo.type === 'redeem_free' ? 'undo_free' : 'undo';

  const { error: insertError } = await supabaseAdmin
    .from('credit_movements')
    .insert({
      order_id: lastRedeemToUndo.order_id,
      type: undoType,
      amount: Math.abs(Number(lastRedeemToUndo.amount || 0)),
      drink_id: lastRedeemToUndo.drink_id,
      note: `Annullamento: ${
        lastRedeemToUndo.note || 'scarico drink'
      } | UNDO_OF:${lastRedeemToUndo.id}`,
      created_by: 'bar',
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    undoneMovementId: lastRedeemToUndo.id,
  });
}