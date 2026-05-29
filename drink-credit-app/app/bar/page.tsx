import { supabaseAdmin } from '@/lib/supabaseAdmin';
import BarClient from './bar-client';

export const dynamic = 'force-dynamic';

export default async function BarPage() {
  const { data: drinks } = await supabaseAdmin
    .from('drinks')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  return (
    <main>
      <h1>Pannello Bar 🍸</h1>
      <BarClient drinks={drinks || []} />
    </main>
  );
}
