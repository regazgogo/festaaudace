import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { pickupCode, barPin } = await req.json();
  if (barPin !== process.env.BAR_PIN) {
    return NextResponse.json({ error: 'PIN bar errato' }, { status: 401 });
  }

  const code = String(pickupCode || '').trim().toUpperCase();
  const { data: wallet } = await supabaseAdmin
    .from('order_credit_balances')
    .select('*')
    .eq('pickup_code', code)
    .maybeSingle();

  if (!wallet) return NextResponse.json({ error: 'Codice non trovato' }, { status: 404 });

  const { data: lastRedeem } = await supabaseAdmin
    .from('credit_movements')
    .select('*')
    .eq('order_id', wallet.order_id)
    .eq('type', 'redeem')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastRedeem) return NextResponse.json({ error: 'Nessun movimento da annullare' }, { status: 400 });

  await supabaseAdmin.from('credit_movements').insert({
    order_id: wallet.order_id,
    type: 'undo',
    amount: Math.abs(lastRedeem.amount),
    drink_id: lastRedeem.drink_id,
    note: `Annullamento: ${lastRedeem.note || ''}`,
    created_by: 'bar',
  });

  return NextResponse.json({ ok: true });
}
