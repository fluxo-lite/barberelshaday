import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Faz uma consulta mínima apenas para manter o banco acordado
  const { data, error } = await supabase.from('agendamentos').select('id').limit(1);
  
  if (error) return res.status(500).json({ status: 'erro' });
  return res.status(200).json({ status: 'ativo', timestamp: new Date().toISOString() });
}