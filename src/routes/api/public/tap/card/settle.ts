import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const Body = z.object({
  device_id: z.string().uuid(),
  device_token: z.string().min(10),
  provider: z.enum(['mercadopago','pagbank','cielo','stone','getnet','infinitepay','rede']),
  ambiente: z.enum(['prod','sandbox']).default('sandbox'),
  order_id: z.string().uuid().nullable().optional(),
  valor: z.number().positive(),
  bandeira: z.string().nullable().optional(),
  modalidade: z.string().nullable().optional(),
  parcelas: z.number().int().min(1).max(24).default(1),
  nsu: z.string().nullable().optional(),
  autorizacao: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export const Route = createFileRoute('/api/public/tap/card/settle')({
  server: { handlers: { POST: async ({ request }) => {
    const parsed = Body.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return new Response(JSON.stringify({ error: 'invalid_body', detail: parsed.error.flatten() }), { status: 400 })
    const b = parsed.data
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: dev, error: devErr } = await supabaseAdmin.rpc('verify_pos_device', { p_device: b.device_id, p_token: b.device_token })
    if (devErr || !dev || !dev.length) return new Response(JSON.stringify({ error: 'invalid_device' }), { status: 401 })
    const empresa_id = (dev[0] as { empresa_id: string }).empresa_id

    const { data, error } = await supabaseAdmin.rpc('record_tap_card_paid', {
      _empresa_id: empresa_id,
      _pos_device_id: b.device_id,
      _provider: b.provider,
      _ambiente: b.ambiente,
      _order_id: b.order_id ?? null,
      _valor: b.valor,
      _bandeira: b.bandeira ?? null,
      _modalidade: b.modalidade ?? null,
      _parcelas: b.parcelas,
      _nsu: b.nsu ?? null,
      _autorizacao: b.autorizacao ?? null,
      _external_id: b.external_id ?? null,
      _raw: b.raw ?? null,
    } as never)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return Response.json({ ok: true, id: data })
  } } },
})
