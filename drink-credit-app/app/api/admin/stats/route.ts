import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type OrderRow = {
  id: string;
  customer_name: string;
  pickup_code: string;
  payment_status: string;
  amount_cents: number;
  credits_purchased: number;
  created_at: string;
};

type MovementRow = {
  id: string;
  order_id: string;
  type: string;
  amount: number;
  created_at: string;
};

function safeNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: Request) {
  const body = await request.json();
  const adminPin = String(body.adminPin || '');

  if (adminPin !== process.env.ADMIN_PIN) {
    return NextResponse.json(
      { error: 'PIN admin non valido' },
      { status: 401 }
    );
  }

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select(
      'id,customer_name,pickup_code,payment_status,amount_cents,credits_purchased,created_at'
    )
    .order('created_at', { ascending: true });

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const { data: movements, error: movementsError } = await supabaseAdmin
    .from('credit_movements')
    .select('id,order_id,type,amount,created_at');

  if (movementsError) {
    return NextResponse.json(
      { error: movementsError.message },
      { status: 500 }
    );
  }

  const orderRows = (orders || []) as OrderRow[];
  const movementRows = (movements || []) as MovementRow[];

  const ordersById = new Map<string, OrderRow>();

  for (const order of orderRows) {
    ordersById.set(order.id, order);
  }

  const walletMap = new Map<
    string,
    {
      pickup_code: string;
      customer_name: string;
      approved_credits: number;
      pending_credits: number;
      used_credits: number;
      available_credits: number;
      approved_amount_cents: number;
      pending_amount_cents: number;
      created_at: string;
      last_order_at: string;
    }
  >();

  for (const order of orderRows) {
    const pickupCode = String(order.pickup_code || '').trim().toUpperCase();

    if (!pickupCode) {
      continue;
    }

    const existing = walletMap.get(pickupCode);

    const wallet = existing || {
      pickup_code: pickupCode,
      customer_name: order.customer_name || '',
      approved_credits: 0,
      pending_credits: 0,
      used_credits: 0,
      available_credits: 0,
      approved_amount_cents: 0,
      pending_amount_cents: 0,
      created_at: order.created_at,
      last_order_at: order.created_at,
    };

    if (order.payment_status === 'paid') {
      wallet.approved_credits += safeNumber(order.credits_purchased);
      wallet.approved_amount_cents += safeNumber(order.amount_cents);
    }

    if (order.payment_status === 'pending') {
      wallet.pending_credits += safeNumber(order.credits_purchased);
      wallet.pending_amount_cents += safeNumber(order.amount_cents);
    }

    if (new Date(order.created_at) < new Date(wallet.created_at)) {
      wallet.created_at = order.created_at;
    }

    if (new Date(order.created_at) > new Date(wallet.last_order_at)) {
      wallet.last_order_at = order.created_at;
    }

    walletMap.set(pickupCode, wallet);
  }

  for (const movement of movementRows) {
    const order = ordersById.get(movement.order_id);

    if (!order) {
      continue;
    }

    const pickupCode = String(order.pickup_code || '').trim().toUpperCase();
    const wallet = walletMap.get(pickupCode);

    if (!wallet) {
      continue;
    }

    const amount = safeNumber(movement.amount);

    wallet.available_credits += amount;

    if (amount < 0) {
      wallet.used_credits += Math.abs(amount);
    }
  }

  const wallets = Array.from(walletMap.values()).sort((a, b) => {
    return b.available_credits - a.available_credits;
  });

  const totals = {
    wallets_count: wallets.length,
    approved_credits: wallets.reduce(
      (total, wallet) => total + safeNumber(wallet.approved_credits),
      0
    ),
    pending_credits: wallets.reduce(
      (total, wallet) => total + safeNumber(wallet.pending_credits),
      0
    ),
    used_credits: wallets.reduce(
      (total, wallet) => total + safeNumber(wallet.used_credits),
      0
    ),
    available_credits: wallets.reduce(
      (total, wallet) => total + safeNumber(wallet.available_credits),
      0
    ),
    approved_amount_cents: wallets.reduce(
      (total, wallet) => total + safeNumber(wallet.approved_amount_cents),
      0
    ),
    pending_amount_cents: wallets.reduce(
      (total, wallet) => total + safeNumber(wallet.pending_amount_cents),
      0
    ),
  };

  return NextResponse.json({
    totals,
    wallets,
  });
}