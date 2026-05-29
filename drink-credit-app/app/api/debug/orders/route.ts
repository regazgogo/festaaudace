import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('customer_name,pickup_code,payment_status,credits_purchased,created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    error,
    data
  });
}