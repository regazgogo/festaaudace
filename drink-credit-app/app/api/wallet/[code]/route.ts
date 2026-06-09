import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
  _: Request,
  context: { params: Promise<{ code: string }> }
) {
  const params = await context.params;
  const code = decodeURIComponent(params.code || '').trim().toUpperCase();

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select(
      'id,customer_name,pickup_code,payment_status,amount_cents,credits_purchased,created_at,paid_at'
    )
    .eq('pickup_code', code)
    .order('created_at', { ascending: true });

  if (ordersError) {
    return NextResponse.json(
      {
        error: 'Errore lettura wallet',
        details: ordersError.message,
      },
      { status: 500 }
    );
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json(
      {
        error: 'Codice non trovato',
        code,
      },
      { status: 404 }
    );
  }

  const orderIds = orders.map((order) => order.id);

  const { data: movements, error: movementsError } = await supabaseAdmin
    .from('credit_movements')
    .select('id,type,amount,note,created_at,drink_id,order_id')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  if (movementsError) {
    return NextResponse.json(
      {
        error: 'Errore lettura movimenti',
        details: movementsError.message,
      },
      { status: 500 }
    );
  }

  const allMovements = movements || [];

  const includedCreditsAvailable = allMovements.reduce((total, movement) => {
    const type = String(movement.type || '');
    const amount = Number(movement.amount || 0);

    if (
      type === 'included' ||
      type === 'redeem_free' ||
      type === 'undo_free'
    ) {
      return total + amount;
    }

    return total;
  }, 0);

  const paidCreditsAvailable = allMovements.reduce((total, movement) => {
    const type = String(movement.type || '');
    const amount = Number(movement.amount || 0);

    if (type === 'purchase' || type === 'redeem' || type === 'undo') {
      return total + amount;
    }

    return total;
  }, 0);

  const creditsAvailable = includedCreditsAvailable + paidCreditsAvailable;

  const paidOrders = orders.filter((order) => order.payment_status === 'paid');
  const pendingOrders = orders.filter(
    (order) => order.payment_status === 'pending'
  );

  const mainOrder = paidOrders[0] || orders[0];

  const totalPaidCents = paidOrders.reduce(
    (total, order) => total + Number(order.amount_cents || 0),
    0
  );

  const totalPurchasedCredits = paidOrders.reduce(
    (total, order) => total + Number(order.credits_purchased || 0),
    0
  );

  const pendingTopUpCents = pendingOrders.reduce(
    (total, order) => total + Number(order.amount_cents || 0),
    0
  );

  const pendingTopUpCredits = pendingOrders.reduce(
    (total, order) => total + Number(order.credits_purchased || 0),
    0
  );

  return NextResponse.json({
    wallet: {
      order_id: mainOrder.id,
      customer_name: mainOrder.customer_name,
      pickup_code: mainOrder.pickup_code,
      payment_status: paidOrders.length > 0 ? 'paid' : mainOrder.payment_status,

      amount_cents: totalPaidCents,
      credits_purchased: totalPurchasedCredits,

      credits_available: creditsAvailable,
      included_credits_available: includedCreditsAvailable,
      paid_credits_available: paidCreditsAvailable,

      pending_amount_cents: pendingTopUpCents,
      pending_credits: pendingTopUpCredits,

      created_at: mainOrder.created_at,
      paid_at: mainOrder.paid_at,
    },
    orders,
    movements: allMovements,
  });
}