import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { data: packages, error: packagesError } = await supabaseAdmin
    .from('credit_packages')
    .select('id,name,price_cents,credits,sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (packagesError) {
    return NextResponse.json({ error: packagesError.message }, { status: 500 });
  }

  const { data: drinks, error: drinksError } = await supabaseAdmin
    .from('drinks')
    .select('id,name,price_credits,category,sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (drinksError) {
    return NextResponse.json({ error: drinksError.message }, { status: 500 });
  }

  return NextResponse.json({
    packages: packages || [],
    drinks: drinks || [],
  });
}