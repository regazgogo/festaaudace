import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
  _: Request,
  context: { params: Promise<{ code: string }> }
) {
  const params = await context.params;
  const code = decodeURIComponent(params.code || '').trim().toUpperCase();

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select(
      'id,customer_name,pickup_code,payment_status,amount_cents,credits_purchased,created_at,paid_at'
    )
    .eq('pickup_code', code)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      {
        error: 'Errore lettura ordine',
        details: orderError.message,
      },
      { status: 500 }
    );
  }

  if (!order) {
    return NextResponse.json(
      {
        error: 'Codice non trovato',
        code,
      },
      { status: 404 }
    );
  }

  const { data: movements, error: movementsError } = await supabaseAdmin
    .from('credit_movements')
    .select('id,type,amount,note,created_at,drink_id')
    .eq('order_id', order.id)
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

  const creditsAvailable = (movements || []).reduce((total, movement) => {
    return total + Number(movement.amount || 0);
  }, 0);

  return NextResponse.json({
    wallet: {
      order_id: order.id,
      customer_name: order.customer_name,
      pickup_code: order.pickup_code,
      payment_status: order.payment_status,
      amount_cents: order.amount_cents,
      credits_purchased: order.credits_purchased,
      credits_available: creditsAvailable,
      created_at: order.created_at,
      paid_at: order.paid_at,
    },
    movements: movements || [],
  });
}