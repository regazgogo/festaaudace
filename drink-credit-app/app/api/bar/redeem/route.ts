import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushoverNotification } from '@/lib/pushover';

function isFreeDrinkName(name: string) {
  const cleanName = name.trim().toUpperCase();

  return cleanName === 'BIRRA FREE' || cleanName === 'SPRITZ FREE';
}

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

  if (!Number.isFinite(drinkPriceCredits) || drinkPriceCredits <= 0) {
    return NextResponse.json(
      { error: 'Prezzo drink non valido' },
      { status: 400 }
    );
  }

  const isFreeDrink = isFreeDrinkName(drinkName);

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

  const customerName = paidOrders[0]?.customer_name || '';
  const orderIds = paidOrders.map((order) => order.id);

  const { data: movements, error: movementsError } = await supabaseAdmin
    .from('credit_movements')
    .select('type,amount')
    .in('order_id', orderIds);

  if (movementsError) {
    return NextResponse.json(
      { error: movementsError.message },
      { status: 500 }
    );
  }

  const includedBalance = (movements || []).reduce((total, movement) => {
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

  const paidBalance = (movements || []).reduce((total, movement) => {
    const type = String(movement.type || '');
    const amount = Number(movement.amount || 0);

    if (type === 'purchase' || type === 'redeem' || type === 'undo') {
      return total + amount;
    }

    return total;
  }, 0);

  if (isFreeDrink && includedBalance < drinkPriceCredits) {
    return NextResponse.json(
      { error: 'Crediti FREE insufficienti' },
      { status: 400 }
    );
  }

  if (!isFreeDrink && paidBalance < drinkPriceCredits) {
    return NextResponse.json(
      { error: 'Crediti ricaricati insufficienti' },
      { status: 400 }
    );
  }

  const mainOrder = paidOrders[0];

  const { error: insertError } = await supabaseAdmin
    .from('credit_movements')
    .insert({
      order_id: mainOrder.id,
      type: isFreeDrink ? 'redeem_free' : 'redeem',
      amount: -drinkPriceCredits,
      drink_id: finalDrinkId,
      note: drinkName,
      created_by: 'bar',
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await sendPushoverNotification({
    title: isFreeDrink
      ? 'FESTA AUDACE - Drink FREE scalato'
      : 'FESTA AUDACE - Drink scalato',
    message:
      `Movimento bar\n` +
      `Nome: ${customerName || '-'}\n` +
      `Codice: ${pickupCode}\n` +
      `Drink: ${drinkName}\n` +
      `Crediti scalati: ${drinkPriceCredits}\n` +
      `Tipo crediti: ${isFreeDrink ? 'FREE' : 'ricaricati'}`,
    priority: 0,
  });

  return NextResponse.json({ ok: true });
}