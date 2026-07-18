import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/tap/reconcile')({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url)
    const token = url.searchParams.get('device_token')
    const dia = url.searchParams.get('dia') // YYYY-MM-DD
    if (!token || !dia) return new Response(JSON.stringify({ error: 'missing_params' }), { status: 400 })

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: dev } = await supabaseAdmin.rpc('verify_pos_device', { _token: token })
    if (!dev || !dev.length) return new Response(JSON.stringify({ error: 'invalid_device' }), { status: 401 })
    const device = dev[0] as { empresa_id: string }

    const { data, error } = await supabaseAdmin.rpc('tap_daily_reconciliation', {
      _empresa_id: device.empresa_id, _dia: dia,
    })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

    // também retorna as últimas cobranças de cartão para reembolso
    const { data: charges } = await supabaseAdmin
      .from('tap_card_charges')
      .select('id, provider, modalidade, bandeira, valor, valor_reembolsado, status, paid_at, order_id, nsu')
      .eq('empresa_id', device.empresa_id)
      .gte('paid_at', `${dia}T00:00:00`)
      .lte('paid_at', `${dia}T23:59:59`)
      .order('paid_at', { ascending: false })

    return Response.json({ ok: true, summary: data ?? [], card_charges: charges ?? [] })
  } } },
})
