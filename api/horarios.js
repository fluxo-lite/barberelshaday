import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { method, headers, body, query } = req;

  // GET: Retorna horários ocupados e bloqueados para uma data
  if (method === 'GET') {
    const date = query.date; // formato YYYY-MM-DD
    if (!date) return res.status(400).json({ error: 'Data não informada' });

    const { data: agendamentos } = await supabase.from('agendamentos').select('hora').eq('data', date);
    const { data: bloqueios } = await supabase.from('bloqueios').select('hora').eq('data', date);

    const ocupados = [
      ...(agendamentos || []).map(a => a.hora),
      ...(bloqueios || []).map(b => b.hora)
    ];

    return res.status(200).json({ ocupados, agendamentos, bloqueios });
  }

  // POST: Bloquear/Desbloquear horário (requer senha de Admin)
  if (method === 'POST') {
    const authHeader = headers.authorization;
    if (authHeader !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Acesso não autorizado' });
    }

    const { data, hora, acao } = body; // acao: 'bloquear' | 'desbloquear'

    if (acao === 'bloquear') {
      await supabase.from('bloqueios').insert([{ data, hora }]);
    } else {
      await supabase.from('bloqueios').delete().match({ data, hora });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}