import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const Body = z.object({
  device_token: z.string().min(10),
  charge_id: z.string().uuid(),
  valor: z.number().positive(),
  raw: z.any().optional(),
})

export const Route = createFileRoute('/api/public/tap/card/refund')({
  server: { handlers: { POST: async ({ request }) => {
    const parsed = Body.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400 })
    const b = parsed.data
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: dev } = await supabaseAdmin.rpc('verify_pos_device', { _token: b.device_token })
    if (!dev || !dev.length) return new Response(JSON.stringify({ error: 'invalid_device' }), { status: 401 })
    const device = dev[0] as { empresa_id: string }

    // valida ownership da cobrança
    const { data: charge } = await supabaseAdmin
      .from('tap_card_charges').select('id, empresa_id').eq('id', b.charge_id).maybeSingle()
    if (!charge || charge.empresa_id !== device.empresa_id) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })
    }

    const { data, error } = await supabaseAdmin.rpc('record_tap_card_refund', {
      _charge_id: b.charge_id, _valor: b.valor, _raw: b.raw ?? null,
    })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    return Response.json({ ok: true, result: data?.[0] ?? null })
  } } },
})
