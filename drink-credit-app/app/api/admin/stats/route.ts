import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { adminPin } = await req.json();
  if (adminPin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: 'PIN admin errato' }, { status: 401 });
  }

  const { data: orders } = await supabaseAdmin.from('orders').select('*');
  const { data: balances } = await supabaseAdmin.from('order_credit_balances').select('*');
  const { data: sales } = await supabaseAdmin.from('drink_sales').select('*').order('quantity', { ascending: false });
  const { data: movements } = await supabaseAdmin
    .from('credit_movements')
    .select('*, drinks(name)')
    .order('created_at', { ascending: false })
    .limit(50);

  const paidOrders = (orders || []).filter((o) => o.payment_status === 'paid');
  const totalIncassato = paidOrders.reduce((sum, o) => sum + o.amount_cents, 0);
  const creditiVenduti = paidOrders.reduce((sum, o) => sum + o.credits_purchased, 0);
  const creditiResidui = (balances || [])
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + Number(b.credits_available || 0), 0);

  return NextResponse.json({
    totals: {
      ordiniPagati: paidOrders.length,
      totaleIncassatoCents: totalIncassato,
      creditiVenduti,
      creditiUsati: creditiVenduti - creditiResidui,
      creditiResidui,
    },
    sales: sales || [],
    movements: movements || [],
  });
}
