// ════════════════════════════════════════════════════════════════
// KEYO BRAIN TICK — versão MÍNIMA (seção 13.1)
// Detecta "0 reservas hoje" por unidade → cria 1 card em keyo_brain_queue.
// SEM web search, SEM LLM ainda (isso entra nas próximas fases).
// Deploy no Supabase: Edge Functions → criar "keyo-brain-tick" → colar.
// Idempotente: não duplica o card do mesmo dia/unidade/tipo.
// ════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hojeBR(): string {
  // Data local BR (UTC-3) no formato YYYY-MM-DD
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

async function sb(path: string, method = "GET", body?: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": SERVICE,
    "Authorization": "Bearer " + SERVICE,
  };
  if (method === "POST") headers["Prefer"] = "return=representation";
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const hoje = hojeBR();
    const unidades = ["1", "2"]; // Aracaju, Salvador
    const criados: unknown[] = [];

    for (const uni of unidades) {
      // 1) Conta reservas/ocupação de HOJE nesta unidade
      //    (ocupacao guarda os slots; status confirmado = reserva ativa)
      const ocup = await sb(
        `ocupacao?select=chave,status&unidade_id=eq.${uni}&data=eq.${hoje}`,
        "GET",
      ).catch(() => []);
      const reservasHoje = Array.isArray(ocup)
        ? ocup.filter((o: any) => o && o.status && o.status !== "livre").length
        : 0;

      if (reservasHoje > 0) continue; // tem reserva → nada a fazer

      // 2) Idempotência: já existe card 'sem_reservas' pendente hoje p/ esta unidade?
      const jaExiste = await sb(
        `keyo_brain_queue?select=id&type=eq.sem_reservas&status=eq.pendente` +
          `&unidade_id=eq.${uni}&criado_em=gte.${hoje}T00:00:00`,
        "GET",
      ).catch(() => []);
      if (Array.isArray(jaExiste) && jaExiste.length > 0) continue;

      // 3) Cria o card
      const nomeUni = uni === "1" ? "Aracaju" : "Salvador";
      const novo = await sb("keyo_brain_queue", "POST", [{
        agent: "Marketing",
        type: "sem_reservas",
        title: `Nenhuma reserva hoje em ${nomeUni}`,
        justification:
          `Não há reservas registradas para hoje (${hoje}) na unidade ${nomeUni}. ` +
          `Uma ação de marketing pode recuperar ocupação.`,
        preview:
          `Sugestão: publicar um story com oferta de última hora e reforçar o link de reservas.`,
        impact: "Potencial de recuperar ocupação nas próximas horas",
        priority: 3,
        status: "pendente",
        unidade_id: uni,
      }]);
      if (novo) criados.push(novo);
    }

    return new Response(
      JSON.stringify({ ok: true, data: hoje, criados: criados.length }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
