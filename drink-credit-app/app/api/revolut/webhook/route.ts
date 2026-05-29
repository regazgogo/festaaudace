import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyRevolutSignature } from '@/lib/revolut';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.REVOLUT_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 });
  }

  const ok = verifyRevolutSignature({
    rawBody,
    secret,
    signatureHeader: req.headers.get('Revolut-Signature'),
    timestampHeader: req.headers.get('Revolut-Request-Timestamp'),
  });

  if (!ok) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    order_id?: string;
    merchant_order_ext_ref?: string;
  };

  if (event.event === 'ORDER_COMPLETED' && event.order_id) {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('revolut_order_id', event.order_id)
      .maybeSingle();

    if (order && order.payment_status !== 'paid') {
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', order.id);

      const existing = await supabaseAdmin
        .from('credit_movements')
        .select('id')
        .eq('order_id', order.id)
        .eq('type', 'purchase')
        .maybeSingle();

      if (!existing.data) {
        await supabaseAdmin.from('credit_movements').insert({
          order_id: order.id,
          type: 'purchase',
          amount: order.credits_purchased,
          note: `Acquisto ${order.credits_purchased} crediti`,
          created_by: 'revolut-webhook',
        });
      }
    }
  }

  if ((event.event === 'ORDER_PAYMENT_FAILED' || event.event === 'ORDER_PAYMENT_DECLINED') && event.order_id) {
    await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('revolut_order_id', event.order_id)
      .eq('payment_status', 'pending');
  }

  return NextResponse.json({ received: true });
}
