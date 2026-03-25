'use strict';

const express = require('express');
const https = require('https');

// ============================================================
// STARTUP LOGS - Para verificar variables de entorno en Render
// ============================================================
console.log('='.repeat(60));
console.log('[STARTUP] WhatsApp Webhook Server - DKLIC PLUS INVESTMENT');
console.log('[STARTUP] Node version:', process.version);
console.log('[STARTUP] Environment:', process.env.NODE_ENV || 'development');
console.log('[STARTUP] Token length:', process.env.WHATSAPP_ACCESS_TOKEN?.length || 0);
console.log('[STARTUP] Token prefix:', process.env.WHATSAPP_ACCESS_TOKEN?.substring(0, 20) || 'NOT SET');
console.log('[STARTUP] Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID || 'NOT SET');
console.log('[STARTUP] Business Account ID:', process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'NOT SET');
console.log('[STARTUP] Verify Token configured:', process.env.WHATSAPP_VERIFY_TOKEN ? 'YES' : 'NOT SET');
console.log('[STARTUP] Gemini API Key configured:', process.env.GEMINI_API_KEY ? 'YES' : 'NOT SET');
console.log('='.repeat(60));

// ============================================================
// CATÁLOGO DE PRODUCTOS - DKLIC PLUS INVESTMENT
// Puertas cortafuego con margen del 67%
// ============================================================
const PRODUCTS = [
  // ASTURMADI - Puertas Cortafuego
  { brand: 'Asturmadi', model: 'RF-30 Simple', description: 'Puerta cortafuego RF-30 simple hoja', price: 850.00, currency: 'USD' },
  { brand: 'Asturmadi', model: 'RF-30 Doble', description: 'Puerta cortafuego RF-30 doble hoja', price: 1450.00, currency: 'USD' },
  { brand: 'Asturmadi', model: 'RF-60 Simple', description: 'Puerta cortafuego RF-60 simple hoja', price: 1050.00, currency: 'USD' },
  { brand: 'Asturmadi', model: 'RF-60 Doble', description: 'Puerta cortafuego RF-60 doble hoja', price: 1750.00, currency: 'USD' },
  { brand: 'Asturmadi', model: 'RF-90 Simple', description: 'Puerta cortafuego RF-90 simple hoja', price: 1250.00, currency: 'USD' },
  { brand: 'Asturmadi', model: 'RF-90 Doble', description: 'Puerta cortafuego RF-90 doble hoja', price: 2050.00, currency: 'USD' },
  { brand: 'Asturmadi', model: 'RF-120 Simple', description: 'Puerta cortafuego RF-120 simple hoja', price: 1450.00, currency: 'USD' },
  { brand: 'Asturmadi', model: 'RF-120 Doble', description: 'Puerta cortafuego RF-120 doble hoja', price: 2350.00, currency: 'USD' },
  // ALVAREZ - Puertas Cortafuego
  { brand: 'Alvarez', model: 'EI-30 Simple', description: 'Puerta cortafuego EI-30 simple hoja', price: 780.00, currency: 'USD' },
  { brand: 'Alvarez', model: 'EI-30 Doble', description: 'Puerta cortafuego EI-30 doble hoja', price: 1350.00, currency: 'USD' },
  { brand: 'Alvarez', model: 'EI-60 Simple', description: 'Puerta cortafuego EI-60 simple hoja', price: 980.00, currency: 'USD' },
  { brand: 'Alvarez', model: 'EI-60 Doble', description: 'Puerta cortafuego EI-60 doble hoja', price: 1650.00, currency: 'USD' },
  { brand: 'Alvarez', model: 'EI-90 Simple', description: 'Puerta cortafuego EI-90 simple hoja', price: 1180.00, currency: 'USD' },
  { brand: 'Alvarez', model: 'EI-90 Doble', description: 'Puerta cortafuego EI-90 doble hoja', price: 1950.00, currency: 'USD' },
  // MESKER - Puertas Industriales
  { brand: 'Mesker', model: 'V-90 Simple', description: 'Puerta industrial V-90 simple hoja', price: 650.00, currency: 'USD' },
  { brand: 'Mesker', model: 'V-90 Doble', description: 'Puerta industrial V-90 doble hoja', price: 1150.00, currency: 'USD' },
  { brand: 'Mesker', model: 'F-180 Simple', description: 'Puerta industrial F-180 simple hoja', price: 750.00, currency: 'USD' },
  { brand: 'Mesker', model: 'F-180 Doble', description: 'Puerta industrial F-180 doble hoja', price: 1350.00, currency: 'USD' },
  // ACCESORIOS
  { brand: 'Accesorios', model: 'Cierra Puertas Hidráulico', description: 'Cierra puertas hidráulico automático', price: 185.00, currency: 'USD' },
  { brand: 'Accesorios', model: 'Barra Antipánico', description: 'Barra antipánico para puertas de emergencia', price: 320.00, currency: 'USD' },
  { brand: 'Accesorios', model: 'Visor 30x100', description: 'Visor cortafuego 30x100mm', price: 95.00, currency: 'USD' },
  { brand: 'Accesorios', model: 'Rejilla Ventilación', description: 'Rejilla de ventilación para puertas cortafuego', price: 75.00, currency: 'USD' },
  { brand: 'Accesorios', model: 'Manija Antipánico', description: 'Manija tipo antipánico para puertas de emergencia', price: 145.00, currency: 'USD' },
];

const ITBIS_RATE = 0.18;
const INSTALL_PRICE_PER_DOOR = 93.50; // RD$ por puerta

// ============================================================
// CONVERSACIONES EN MEMORIA (sin base de datos)
// ============================================================
const conversations = new Map(); // waId -> [{ role, content }]

function getHistory(waId) {
  if (!conversations.has(waId)) {
    conversations.set(waId, []);
  }
  return conversations.get(waId);
}

function addToHistory(waId, role, content) {
  const history = getHistory(waId);
  history.push({ role, content });
  // Mantener solo los últimos 20 mensajes
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

// ============================================================
// GEMINI API
// ============================================================
async function callGemini(systemPrompt, history, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  // Construir contenidos para Gemini
  const contents = [];

  // Agregar historial previo
  for (const msg of history) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  // Agregar mensaje actual del usuario
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const payload = JSON.stringify({
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7
    }
  });

  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            console.error('[Gemini] Error response:', data);
            reject(new Error(`Gemini API error ${res.statusCode}: ${data}`));
            return;
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            console.error('[Gemini] No text in response:', JSON.stringify(parsed));
            reject(new Error('No text in Gemini response'));
            return;
          }
          resolve(text);
        } catch (e) {
          reject(new Error(`Failed to parse Gemini response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ============================================================
// SISTEMA PROMPT DEL CHATBOT
// ============================================================
function buildSystemPrompt() {
  const productList = PRODUCTS.map(p =>
    `- ${p.brand} ${p.model}: ${p.description} - $${p.price.toFixed(2)} USD`
  ).join('\n');

  return `Eres un asistente de ventas profesional de DKLIC PLUS INVESTMENT, especializado en puertas cortafuego y accesorios de seguridad.

EMPRESA: DKLIC PLUS INVESTMENT
ASESOR: Alejandro Plasencia
TELÉFONO: +1 (809) 555-0100
EMAIL: ventas@dklicrd.com

TU ROL:
- Atender consultas de clientes sobre puertas cortafuego y accesorios
- Generar cotizaciones con precios en USD
- Aplicar ITBIS del 18% cuando corresponda
- Informar sobre instalación (RD$93.50 por puerta) y transporte
- Responder siempre en español con tono profesional y amigable

CATÁLOGO DE PRODUCTOS:
${productList}

NOTAS IMPORTANTES PARA COTIZACIONES:
- Los precios incluyen margen comercial del 67%
- ITBIS 18% se aplica sobre el subtotal
- Instalación: RD$93.50 por puerta (opcional)
- Transporte según distancia (cotizar por separado)
- Tiempo de entrega: 15-30 días hábiles
- Garantía: 1 año contra defectos de fabricación
- Pago: 50% anticipo, 50% contra entrega

CUANDO EL CLIENTE SOLICITE COTIZACIÓN:
1. Pregunta qué productos necesita (marca, modelo, cantidad)
2. Confirma las medidas del hueco (ancho x alto en cm)
3. Pregunta si necesita instalación
4. Calcula: Subtotal + ITBIS 18% = Total
5. Presenta la cotización de forma clara y ordenada

Siempre mantén un tono profesional, amigable y servicial.`;
}

// ============================================================
// WHATSAPP API - ENVIAR MENSAJE
// ============================================================
async function sendWhatsAppMessage(to, message) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token) {
    throw new Error('WHATSAPP_ACCESS_TOKEN no configurada');
  }
  if (!phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID no configurada');
  }

  console.log('[WhatsApp] Enviando mensaje a:', to);
  console.log('[WhatsApp] Token length:', token.length);
  console.log('[WhatsApp] Phone Number ID:', phoneNumberId);

  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: { body: message }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.facebook.com',
      path: `/v18.0/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    console.log('[WhatsApp] Request to:', options.hostname + options.path);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log('[WhatsApp] Response status:', res.statusCode);
        console.log('[WhatsApp] Response body:', data);
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`WhatsApp API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('[WhatsApp] Request error:', err);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// ============================================================
// EXPRESS APP
// ============================================================
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WhatsApp Webhook - DKLIC PLUS INVESTMENT',
    timestamp: new Date().toISOString(),
    tokenConfigured: !!process.env.WHATSAPP_ACCESS_TOKEN,
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

// ============================================================
// WEBHOOK VERIFICACIÓN (GET)
// ============================================================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Webhook] Verification request:', { mode, token: token ? '***' : 'missing' });

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'grupo_arboleda_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Webhook] ✅ Verified successfully');
    res.status(200).send(challenge);
  } else {
    console.warn('[Webhook] ❌ Verification failed');
    res.status(403).send('Forbidden');
  }
});

// ============================================================
// WEBHOOK MENSAJES (POST)
// ============================================================
app.post('/webhook', (req, res) => {
  // Responder inmediatamente a Meta
  res.status(200).send('EVENT_RECEIVED');

  // Procesar de forma asíncrona
  processMessage(req.body).catch(err => {
    console.error('[Webhook] Error processing message:', err);
  });
});

async function processMessage(body) {
  try {
    console.log('[Webhook] Processing body:', JSON.stringify(body, null, 2));

    const entry = body?.entry?.[0];
    if (!entry) {
      console.log('[Webhook] No entry found');
      return;
    }

    const changes = entry?.changes?.[0];
    if (!changes) {
      console.log('[Webhook] No changes found');
      return;
    }

    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      console.log('[Webhook] No messages found');
      return;
    }

    for (const message of messages) {
      if (message.type !== 'text') {
        console.log('[Webhook] Skipping non-text message:', message.type);
        continue;
      }

      const waId = message.from;
      const text = message.text?.body;

      if (!text) {
        console.log('[Webhook] Empty text message');
        continue;
      }

      console.log(`[Webhook] Message from ${waId}: "${text}"`);

      // Obtener historial de conversación
      const history = getHistory(waId);

      // Agregar mensaje del usuario al historial
      addToHistory(waId, 'user', text);

      try {
        // Llamar a Gemini
        console.log('[Gemini] Calling API...');
        const systemPrompt = buildSystemPrompt();
        const response = await callGemini(systemPrompt, history.slice(0, -1), text);
        console.log('[Gemini] Response:', response.substring(0, 100) + '...');

        // Agregar respuesta al historial
        addToHistory(waId, 'assistant', response);

        // Enviar respuesta por WhatsApp
        await sendWhatsAppMessage(waId, response);
        console.log(`[Webhook] ✅ Response sent to ${waId}`);

      } catch (err) {
        console.error('[Webhook] Error generating/sending response:', err.message);

        // Intentar enviar mensaje de error al cliente
        try {
          await sendWhatsAppMessage(waId,
            'Disculpe, estamos experimentando dificultades técnicas. Por favor contáctenos directamente al +1 (809) 555-0100 o a ventas@dklicrd.com'
          );
        } catch (sendErr) {
          console.error('[Webhook] Error sending error message:', sendErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Webhook] Fatal error:', err);
  }
}

// ============================================================
// INICIAR SERVIDOR
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[SERVER] Webhook URL: https://YOUR-DOMAIN/webhook`);
  console.log(`[SERVER] Health check: https://YOUR-DOMAIN/`);
  console.log('='.repeat(60));
});
