import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  const body = await request.json();

  const adminPin = String(body.adminPin || '');
  const pickupCode = String(body.pickupCode || '').trim().toUpperCase();

  if (adminPin !== process.env.ADMIN_PIN) {
    return NextResponse.json(
      { error: 'PIN admin non valido' },
      { status: 401 }
    );
  }

  if (!pickupCode) {
    return NextResponse.json(
      { error: 'Codice wallet mancante' },
      { status: 400 }
    );
  }

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id,pickup_code')
    .eq('pickup_code', pickupCode);

  if (ordersError) {
    return NextResponse.json(
      { error: ordersError.message },
      { status: 500 }
    );
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json(
      { error: 'Wallet non trovato' },
      { status: 404 }
    );
  }

  const orderIds = orders.map((order) => order.id);

  const { error: movementsDeleteError } = await supabaseAdmin
    .from('credit_movements')
    .delete()
    .in('order_id', orderIds);

  if (movementsDeleteError) {
    return NextResponse.json(
      { error: movementsDeleteError.message },
      { status: 500 }
    );
  }

  const { error: ordersDeleteError } = await supabaseAdmin
    .from('orders')
    .delete()
    .eq('pickup_code', pickupCode);

  if (ordersDeleteError) {
    return NextResponse.json(
      { error: ordersDeleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    deletedWallet: pickupCode,
  });
}