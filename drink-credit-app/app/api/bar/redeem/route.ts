import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  const body = await request.json();

  const pickupCode = String(body.pickupCode || '').trim().toUpperCase();
  const drinkId = String(body.drinkId || '').trim();
  const customDrinkName = String(body.customDrinkName || '').trim();
  const customPriceCredits = Number(body.customPriceCredits || 0);
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

  let drinkName = '';
  let drinkPriceCredits = 0;
  let finalDrinkId: string | null = null;

  if (drinkId) {
    const { data: drink, error: drinkError } = await supabaseAdmin
      .from('drinks')
      .select('id,name,price_credits,active')
      .eq('id', drinkId)
      .eq('active', true)
      .maybeSingle();

    if (drinkError || !drink) {
      return NextResponse.json({ error: 'Drink non trovato' }, { status: 404 });
    }

    drinkName = drink.name;
    drinkPriceCredits = Number(drink.price_credits || 0);
    finalDrinkId = drink.id;
  } else {
    if (!customDrinkName || !customPriceCredits) {
      return NextResponse.json(
        { error: 'Drink personalizzato non valido' },
        { status: 400 }
      );
    }

    drinkName = customDrinkName;
    drinkPriceCredits = customPriceCredits;
    finalDrinkId = null;
  }

  const { data: paidOrders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id,customer_name,pickup_code,payment_status,created_at')
    .eq('pickup_code', pickupCode)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: true });

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  if (!paidOrders || paidOrders.length === 0) {
    return NextResponse.json(
      { error: 'Wallet non trovato o non ancora approvato' },
      { status: 404 }
    );
  }

  const orderIds = paidOrders.map((order) => order.id);

  const { data: movements, error: movementsError } = await supabaseAdmin
    .from('credit_movements')
    .select('amount')
    .in('order_id', orderIds);

  if (movementsError) {
    return NextResponse.json(
      { error: movementsError.message },
      { status: 500 }
    );
  }

  const creditsAvailable = (movements || []).reduce((total, movement) => {
    return total + Number(movement.amount || 0);
  }, 0);

  if (creditsAvailable < drinkPriceCredits) {
    return NextResponse.json(
      { error: 'Crediti insufficienti' },
      { status: 400 }
    );
  }

  const mainOrder = paidOrders[0];

  const { error: insertError } = await supabaseAdmin
    .from('credit_movements')
    .insert({
      order_id: mainOrder.id,
      type: 'redeem',
      amount: -drinkPriceCredits,
      drink_id: finalDrinkId,
      note: drinkName,
      created_by: 'bar',
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}