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
const pendingQuotations = new Map(); // quotationId -> { clientWaId, data, status }
const quotationCounter = { value: 1000 };

const OWNER_PHONE = '18093839972'; // Número del propietario sin + ni espacios

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

function createQuotationId() {
  quotationCounter.value++;
  return `COT-${quotationCounter.value}`;
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

  return `Eres un asistente de ventas profesional de DKLIC PLUS INVESTMENT, especializado en soluciones integrales de seguridad, puertas, particiones y accesorios para espacios comerciales, industriales y hoteleros.

EMPRESA: DKLIC PLUS INVESTMENT
ASESOR: Ricardo M Vega
TELÉFONO: +1 (809) 555-0100
EMAIL: ventas@dklicrd.com

⚠️ REGLA ABSOLUTA Y ESTRICTA - POLÍTICA DE PRECIOS:
════════════════════════════════════════════════════════════
NUNCA MOSTRAR PRECIOS en ninguna respuesta, EXCEPTO cuando:
- El cliente haya dicho explícitamente: "quiero una cotización",
  "necesito cotización", "cuánto cuesta", "dame un presupuesto",
  "precio", o palabras similares que indiquen solicitud de cotización.

Si el cliente pregunta por productos SIN solicitar cotización:
✓ Describe brevemente las características del producto
✓ Menciona los modelos disponibles (SIN PRECIOS)
✓ Pregunta si desea una cotización formal
✗ NUNCA incluyas precios en la respuesta
✗ NUNCA muestres valores en dólares o pesos
✗ NUNCA menciones ITBIS o cálculos de precios
════════════════════════════════════════════════════════════

ESTRATEGIA DE CONVERSACIÓN:

1. PRIMER CONTACTO / SALUDOS:
   - Responde de forma breve y amigable
   - Preséntate como asesor de DKLIC PLUS INVESTMENT
   - Menciona las CATEGORÍAS de productos disponibles:
     * Cerraduras Inteligentes
     * Puertas Metálicas Cortafuego
     * Divisiones de Baños
     * Particiones Móviles Acústicas
     * Productos para Hoteles
     * Particiones de Vidrio
   - NO muestres precios ni detalles de modelos en el primer contacto
   - NUNCA incluyas precios en tus respuestas iniciales
   - Pregunta qué necesita el cliente o en cuál de estas categorías podemos ayudarle

2. CONVERSACIÓN NATURAL:
   - Escucha lo que el cliente necesita
   - Haz preguntas para entender mejor su proyecto
   - Sugiere opciones según sus necesidades
   - Mantén un tono conversacional y amigable
   - NUNCA menciones precios a menos que el cliente lo solicite explícitamente
   - Si pregunta por un producto específico, describe características y modelos (SIN PRECIOS)
   - Siempre ofrece: "¿Desea que le prepare una cotización formal con precios?"

3. CUANDO CLIENTE SOLICITE COTIZACIÓN FORMAL:
   - Envía EXACTAMENTE este mensaje:
   
   Para preparar su cotización formal, necesito los siguientes datos:
   
   *A nombre de quién va la cotización:*
   - RNC o Cédula
   - Email de contacto
   
   *Detalles del producto:*
   - Tipo de puerta/s
   - Cantidad/es
   - Dimensiones (ancho/alto)
   
   *Accesorios (indicar si aplica):*
   - Barras antipánico
   - Visores
   - Cierra puertas
   
   - ¿Incluye instalación? Si es así, especificar ubicación aproximada.
   
   - Una vez el cliente proporcione todos los datos:
     * Calcula: Subtotal = suma de precios de productos + accesorios
     * ITBIS = Subtotal × 0.18
     * Instalación = cantidad de puertas × RD$93.50 (si aplica)
     * TOTAL = Subtotal + ITBIS + Instalación
   - Presenta la cotización profesional con:
     * Empresa: DKLIC PLUS INVESTMENT
     * Asesor: Ricardo M Vega
     * Fecha
     * Detalles de productos y precios
     * Términos de pago: 50% anticipo, 50% contra entrega
   - IMPORTANTE: Al finalizar la cotización, incluye la palabra ITBIS en tu respuesta
   - Esto activará el flujo de aprobación automático

4. RESPUESTAS SOBRE LAS 6 CATEGORÍAS DE PRODUCTOS:
   Cuando el cliente pregunte sobre cualquiera de estas categorías:
   
   - CERRADURAS INTELIGENTES: Sistemas de acceso inteligente, control remoto, biométrico
   - PUERTAS METÁLICAS CORTAFUEGO: Protección contra incendios, RF-30/60/90/120, EI-30/60/90
   - DIVISIONES DE BAÑOS: Tabiques para baños, privacidad, durabilidad
   - PARTICIONES MÓVILES ACÚSTICAS: Divisiones móviles, aislamiento acústico, flexibilidad
   - PRODUCTOS PARA HOTELES: Soluciones especializadas para hospedaje, durabilidad, estética
   - PARTICIONES DE VIDRIO: Divisiones de vidrio, transparencia, modernidad
   
   Para cada categoría:
   ✓ Describe brevemente las características principales
   ✓ Menciona aplicaciones o usos comunes
   ✓ Pregunta si desea una cotización formal
   ✗ NUNCA muestres precios sin solicitud explícita

5. FLUJO DE APROBACIÓN (automático):
   - Cuando completes una cotización, el sistema enviará automáticamente:
     * La cotización al propietario para aprobación
     * Un mensaje al cliente: Su solicitud de cotización ha sido recibida. En breve recibirá su cotización formal. Gracias por contactar a DKLIC PLUS INVESTMENT!
   - El propietario responderá con APROBAR o RECHAZAR
   - Si APROBAR: se enviará la cotización completa al cliente
   - Si RECHAZAR: se notificará al cliente

CATÁLOGO COMPLETO (usar solo cuando se solicite):
${productList}

NOTAS PARA COTIZACIONES:
- Los precios incluyen margen comercial del 67%
- ITBIS 18% se aplica sobre el subtotal
- Instalación: RD$93.50 por puerta (opcional)
- Transporte según distancia (cotizar por separado)
- Tiempo de entrega: 15-30 días hábiles
- Garantía: 1 año contra defectos de fabricación
- Pago: 50% anticipo, 50% contra entrega

TONO Y ESTILO:
- Profesional pero amigable
- Conversacional, no robótico
- Respuestas breves inicialmente, más detalle cuando se solicite
- Siempre en español
- Enfocado en entender las necesidades del cliente primero`;
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

      // Verificar si es el propietario respondiendo a una cotización
      if (waId === OWNER_PHONE) {
        const upperText = text.toUpperCase().trim();
        if (upperText === 'APROBAR' || upperText === 'RECHAZAR') {
          console.log(`[Owner] ${upperText} command from owner`);
          await handleOwnerResponse(waId, upperText);
          continue;
        }
      }

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
        
        // Verificar si la respuesta contiene indicador de cotización completa
        if (response.includes('ITBIS') && response.includes('TOTAL')) {
          // Enviar mensaje de confirmación al cliente
          await sendWhatsAppMessage(waId, 'Su solicitud de cotización ha sido recibida. En breve recibirá su cotización formal. ¡Gracias por contactar a DKLIC PLUS INVESTMENT!');
          // Enviar a aprobación del propietario
          await handleQuotationReady(waId, response);
        }

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
// MANEJO DE APROBACIÓN/RECHAZO DE COTIZACIONES
// ============================================================
async function handleQuotationReady(clientWaId, quotationText) {
  try {
    // Crear ID de cotización
    const quotationId = createQuotationId();
    
    // Guardar cotización pendiente
    pendingQuotations.set(quotationId, {
      clientWaId,
      quotationText,
      status: 'pending',
      createdAt: new Date()
    });
    
    console.log(`[Quotation] Created quotation ${quotationId} for client ${clientWaId}`);
    
    // Enviar a aprobación del propietario
    const approvalMessage = `📋 *COTIZACIÓN PENDIENTE DE APROBACIÓN*\n\nCliente: ${clientWaId}\nCotización ID: ${quotationId}\n\n${quotationText}\n\nResponde *APROBAR* para enviarla al cliente o *RECHAZAR* para cancelarla.`;
    
    await sendWhatsAppMessage(OWNER_PHONE, approvalMessage);
    console.log(`[Quotation] Approval request sent to owner for ${quotationId}`);
    
    // Guardar el ID de cotización en la conversación del cliente para referencia futura
    addToHistory(clientWaId, 'system', `quotation_id:${quotationId}`);
    
  } catch (err) {
    console.error('[Quotation] Error handling quotation:', err.message);
  }
}

async function handleOwnerResponse(ownerWaId, action) {
  try {
    // Encontrar la cotización más reciente pendiente
    let quotationId = null;
    let quotationData = null;
    
    for (const [qId, qData] of pendingQuotations.entries()) {
      if (qData.status === 'pending') {
        quotationId = qId;
        quotationData = qData;
        break;
      }
    }
    
    if (!quotationId || !quotationData) {
      await sendWhatsAppMessage(ownerWaId, '❌ No hay cotizaciones pendientes de aprobación.');
      return;
    }
    
    if (action === 'APROBAR') {
      // Aprobar cotización
      quotationData.status = 'approved';
      
      // Enviar cotización al cliente
      const clientMessage = `✅ *SU COTIZACIÓN HA SIDO APROBADA*\n\n${quotationData.quotationText}\n\nPara confirmar su pedido, por favor contáctenos al +1 (809) 555-0100 o a ventas@dklicrd.com`;
      
      await sendWhatsAppMessage(quotationData.clientWaId, clientMessage);
      
      // Confirmar al propietario
      await sendWhatsAppMessage(ownerWaId, `✅ Cotización ${quotationId} enviada al cliente.`);
      
      console.log(`[Quotation] Quotation ${quotationId} approved and sent to client`);
      
    } else if (action === 'RECHAZAR') {
      // Rechazar cotización
      quotationData.status = 'rejected';
      
      // Notificar al cliente
      const clientMessage = `⚠️ Su solicitud de cotización ha sido revisada. Por favor contáctenos directamente al +1 (809) 555-0100 para más información.`;
      
      await sendWhatsAppMessage(quotationData.clientWaId, clientMessage);
      
      // Confirmar al propietario
      await sendWhatsAppMessage(ownerWaId, `❌ Cotización ${quotationId} rechazada.`);
      
      console.log(`[Quotation] Quotation ${quotationId} rejected`);
    }
    
  } catch (err) {
    console.error('[Owner] Error handling owner response:', err.message);
    try {
      await sendWhatsAppMessage(ownerWaId, '❌ Error procesando la solicitud. Intente de nuevo.');
    } catch (e) {
      console.error('[Owner] Error sending error message:', e.message);
    }
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
