import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { makePickupCode } from '@/lib/codes';
import { createRevolutOrder } from '@/lib/revolut';

export async function POST(req: Request) {
  try {
    const { customerName, packageId } = await req.json();
    if (!customerName || !packageId) {
      return NextResponse.json({ error: 'Nome e pacchetto sono obbligatori' }, { status: 400 });
    }

    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('active', true)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Pacchetto non trovato' }, { status: 404 });
    }

    let pickupCode = makePickupCode(customerName);
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await supabaseAdmin.from('orders').select('id').eq('pickup_code', pickupCode).maybeSingle();
      if (!exists.data) break;
      pickupCode = makePickupCode(customerName);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: customerName.trim(),
        pickup_code: pickupCode,
        package_id: pkg.id,
        amount_cents: pkg.price_cents,
        credits_purchased: pkg.credits,
        payment_status: 'pending',
      })
      .select('*')
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Errore creazione ordine' }, { status: 500 });
    }

    const revolutOrder = await createRevolutOrder({
      amountCents: pkg.price_cents,
      description: `${pkg.name} - ${customerName}`,
      redirectUrl: `${siteUrl}/success?code=${encodeURIComponent(pickupCode)}`,
      merchantOrderExtRef: order.id,
    });

    await supabaseAdmin
      .from('orders')
      .update({
        revolut_order_id: revolutOrder.id,
        revolut_checkout_url: revolutOrder.checkout_url,
      })
      .eq('id', order.id);

    return NextResponse.json({
      checkoutUrl: revolutOrder.checkout_url,
      pickupCode,
      orderId: order.id,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Errore checkout' }, { status: 500 });
  }
}
