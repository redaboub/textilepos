// =====================================================================
// TextilePOS — Edge Function : alerte WhatsApp stock faible (groupée, arabe)
// =====================================================================
// Reçoit { items: [{ name, stock }, ...] } et envoie UN SEUL message WhatsApp
// en arabe au super admin via le Sandbox Twilio.
//
// Secrets Supabase requis :
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, ALERT_WHATSAPP_TO
// =====================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  try {
    const payload = await req.json();

    // Supporte 2 formats : { items: [...] } (groupé) ou { product_name, stock } (unique, compat)
    let items: { name: string; stock: number }[] = [];
    if (Array.isArray(payload.items)) {
      items = payload.items;
    } else if (payload.product_name) {
      items = [{ name: payload.product_name, stock: payload.stock }];
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no items' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const from = Deno.env.get('TWILIO_WHATSAPP_FROM');
    const to = Deno.env.get('ALERT_WHATSAPP_TO');

    if (!accountSid || !authToken || !from || !to) {
      return new Response(JSON.stringify({ error: 'Configuration Twilio manquante' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Message en ARABE ---
    // RLM (U+200F) en début de chaque ligne pour forcer le contexte RTL et
    // empêcher WhatsApp de fusionner les lignes contenant du texte latin.
    const RLM = '\u200F';
    const lines: string[] = [];
    lines.push(`${RLM}⚠️ *تنبيه: مخزون منخفض — TextilePOS*`);
    lines.push('');
    if (items.length === 1) {
      lines.push(`${RLM}المنتج *${items[0].name}* وصل إلى مستوى منخفض.`);
      lines.push(`${RLM}الكمية المتبقية: *${items[0].stock} م*`);
    } else {
      lines.push(`${RLM}${items.length} منتجات وصلت إلى مستوى منخفض:`);
      lines.push('');
      for (const it of items) {
        // Chaque produit sur sa propre ligne, préfixé RLM
        lines.push(`${RLM}• *${it.name}* — ${it.stock} م`);
      }
    }
    lines.push('');
    lines.push(`${RLM}يُرجى إعادة التزويد.`);
    const body = lines.join('\n');

    // Appel Twilio
    const params = new URLSearchParams();
    params.append('From', from);
    params.append('To', to);
    params.append('Body', body);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const resp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Twilio error', detail: result }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, sid: result.sid, count: items.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
