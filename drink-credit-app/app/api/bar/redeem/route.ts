import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { pickupCode, drinkId, barPin } = await req.json();
    if (barPin !== process.env.BAR_PIN) {
      return NextResponse.json({ error: 'PIN bar errato' }, { status: 401 });
    }
    if (!pickupCode || !drinkId) {
      return NextResponse.json({ error: 'Codice e drink obbligatori' }, { status: 400 });
    }

    const code = String(pickupCode).trim().toUpperCase();

    const { data: wallet } = await supabaseAdmin
      .from('order_credit_balances')
      .select('*')
      .eq('pickup_code', code)
      .maybeSingle();

    if (!wallet) return NextResponse.json({ error: 'Codice non trovato' }, { status: 404 });
    if (wallet.payment_status !== 'paid') return NextResponse.json({ error: 'Ordine non pagato' }, { status: 400 });

    const { data: drink } = await supabaseAdmin
      .from('drinks')
      .select('*')
      .eq('id', drinkId)
      .eq('active', true)
      .single();

    if (!drink) return NextResponse.json({ error: 'Drink non trovato' }, { status: 404 });
    if (wallet.credits_available < drink.price_credits) {
      return NextResponse.json({ error: `Crediti insufficienti: saldo ${wallet.credits_available}` }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('credit_movements').insert({
      order_id: wallet.order_id,
      type: 'redeem',
      amount: -drink.price_credits,
      drink_id: drink.id,
      note: drink.name,
      created_by: 'bar',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, newBalance: wallet.credits_available - drink.price_credits });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Errore scarico' }, { status: 500 });
  }
}
