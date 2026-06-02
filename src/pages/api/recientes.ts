// src/pages/api/recientes.ts
import { createClient } from '@supabase/supabase-js';
export const prerender = false;

export const GET = async () => {
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );

  // Traemos las últimas 12 películas ordenadas por fecha de incorporación
  const { data, error } = await supabase
    .from('filmoteca')
    .select('*')
    .order('incorporacion', { ascending: false })
    .limit(12);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(data), { status: 200 });
};
