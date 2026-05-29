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

  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      payment_status: 'cancelled',
    })
    .eq('id', orderId)
    .eq('payment_status', 'pending');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}