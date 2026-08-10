import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { clienteNome, clienteEmail, clienteTelefone, servico, data, hora } = req.body;

  // 1. Salva no Supabase
  const { data: result, error } = await supabase.from('agendamentos').insert([{
    cliente_nome: clienteNome,
    cliente_email: clienteEmail,
    cliente_telefone: clienteTelefone,
    servico_id: servico.id,
    servico_nome: servico.title,
    preco: servico.price,
    data: data,
    hora: hora
  }]);

  if (error) return res.status(500).json({ error: error.message });

  // 2. Formata mensagem para o Telegram
  const msg = `<b>NOVO AGENDAMENTO! ✂️</b>\n\n` +
              `<b>Cliente:</b> ${clienteNome}\n` +
              `<b>Telefone:</b> ${clienteTelefone}\n` +
              `<b>Serviço:</b> ${servico.title} (R$ ${servico.price.toFixed(2)})\n` +
              `<b>Data/Hora:</b> ${data} às ${hora}`;

  // 3. Notifica via Telegram
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
  });

  return res.status(200).json({ success: true });
}