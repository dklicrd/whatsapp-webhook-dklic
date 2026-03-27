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

// ============================================================
// FIX PROBLEMA 1: Deduplicación de mensajes
// Meta puede reenviar el mismo mensaje si no recibe 200 OK a tiempo.
// Guardamos los IDs de mensajes ya procesados para evitar duplicados.
// ============================================================
const processedMessageIds = new Set();
const MESSAGE_ID_TTL_MS = 5 * 60 * 1000; // 5 minutos de memoria

function isMessageAlreadyProcessed(messageId) {
  return processedMessageIds.has(messageId);
}

function markMessageAsProcessed(messageId) {
  processedMessageIds.add(messageId);
  // Limpiar el ID después de 5 minutos para no acumular memoria
  setTimeout(() => {
    processedMessageIds.delete(messageId);
  }, MESSAGE_ID_TTL_MS);
}

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

  // Agregar historial previo (excluyendo el mensaje actual)
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  // Agregar mensaje actual del usuario
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const requestBody = JSON.stringify({
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    console.log('[Gemini] Calling API with model: gemini-2.5-flash');

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log('[Gemini] Response status:', res.statusCode);
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              resolve(text);
            } else {
              console.error('[Gemini] Unexpected response structure:', data.substring(0, 300));
              reject(new Error('No text in Gemini response'));
            }
          } catch (e) {
            reject(new Error('Failed to parse Gemini response: ' + e.message));
          }
        } else {
          console.error('[Gemini] Error response:', data.substring(0, 300));
          reject(new Error(`Gemini API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Gemini] Request error:', err);
      reject(err);
    });

    req.write(requestBody);
    req.end();
  });
}

// ============================================================
// SISTEMA PROMPT DEL CHATBOT
// FIX PROBLEMA 2: Prompt reforzado para las 6 categorías
// ============================================================
function buildSystemPrompt() {
  const productList = PRODUCTS.map(p =>
    `- ${p.brand} ${p.model}: ${p.description} - $${p.price.toFixed(2)} USD`
  ).join('\n');

  return `Eres un asistente de ventas profesional de DKLIC PLUS INVESTMENT.

EMPRESA: DKLIC PLUS INVESTMENT
ASESOR: Ricardo M Vega
TELÉFONO: +1 (809) 555-0100
EMAIL: ventas@dklicrd.com
SITIO WEB: https://dklicrd.com

════════════════════════════════════════════════════════════
⚠️ ALCANCE DE TU TRABAJO - MUY IMPORTANTE:
════════════════════════════════════════════════════════════
Representas a DKLIC PLUS INVESTMENT y puedes atender consultas
sobre LAS SIGUIENTES 6 CATEGORÍAS DE PRODUCTOS:

1. Cerraduras Inteligentes
2. Puertas Metálicas Cortafuego
3. Divisiones de Baños
4. Particiones Móviles Acústicas
5. Productos para Hoteles
6. Particiones de Vidrio

NUNCA digas que solo manejas puertas cortafuego.
NUNCA rechaces una consulta sobre las otras categorías.
SIEMPRE responde con información útil sobre cualquiera de las 6 categorías.
════════════════════════════════════════════════════════════

════════════════════════════════════════════════════════════
⚠️ REGLA ABSOLUTA - POLÍTICA DE PRECIOS:
════════════════════════════════════════════════════════════
NUNCA MOSTRAR PRECIOS en ninguna respuesta, EXCEPTO cuando
el cliente diga explícitamente: "quiero una cotización",
"necesito cotización", "cuánto cuesta", "dame un presupuesto",
"precio", o palabras similares.

✗ NUNCA incluyas precios en respuestas informativas
✗ NUNCA muestres valores en dólares o pesos
✗ NUNCA menciones ITBIS o cálculos de precios
✓ Cuando el cliente pregunte por productos: describe características (SIN PRECIOS)
✓ Siempre ofrece: "¿Desea que le prepare una cotización formal?"
════════════════════════════════════════════════════════════

ESTRATEGIA DE CONVERSACIÓN:

1. PRIMER CONTACTO / SALUDOS:
   Envía EXACTAMENTE este mensaje de bienvenida:

   👋 ¡Bienvenido a *DKLIC PLUS INVESTMENT*!
   
   Soy Ricardo M Vega, su asesor de ventas. ¿En qué puedo ayudarle hoy?
   
   Estas son nuestras categorías de productos:
   
   🔐 *Cerraduras Inteligentes*
   https://dklicrd.com/cerraduras-inteligentes.html
   
   🚪 *Puertas Metálicas Cortafuego*
   https://dklicrd.com/puertas_metalicas.html
   
   🚹 *Divisiones de Baños*
   https://dklicrd.com/Divisiones_Banos.html
   
   🏛️ *Particiones Móviles Acústicas*
   https://dklicrd.com/Particiones_Acusticas.html
   
   🏨 *Productos para Hoteles*
   https://dklicrd.com/Productos_Hoteles.html
   
   🔮 *Particiones de Vidrio*
   https://dklicrd.com/Particiones_Vidrios.html
   
   ¿Sobre cuál de estas categorías le gustaría más información?

2. CONVERSACIÓN NATURAL:
   - Escucha lo que el cliente necesita
   - Haz preguntas para entender mejor su proyecto
   - Sugiere opciones según sus necesidades
   - Mantén un tono conversacional y amigable
   - NUNCA menciones precios a menos que el cliente lo solicite
   - Si pregunta por un producto, describe características (SIN PRECIOS)
   - Siempre ofrece: "¿Desea que le prepare una cotización formal con precios?"

3. CUANDO CLIENTE SOLICITE COTIZACIÓN FORMAL:
   Envía EXACTAMENTE este mensaje:
   
   Para preparar su cotización formal, necesito los siguientes datos:
   
   *A nombre de quién va la cotización:*
   - RNC o Cédula
   - Email de contacto
   
   *Detalles del producto:*
   - Tipo de producto/s
   - Cantidad/es
   - Dimensiones (ancho/alto) si aplica
   
   *Accesorios (indicar si aplica):*
   - Barras antipánico
   - Visores
   - Cierra puertas
   
   - ¿Incluye instalación? Si es así, especificar ubicación aproximada.
   
   Una vez el cliente proporcione todos los datos:
   * Calcula: Subtotal = suma de precios de productos + accesorios
   * ITBIS = Subtotal × 0.18
   * Instalación = cantidad de puertas × RD$93.50 (si aplica)
   * TOTAL = Subtotal + ITBIS + Instalación
   Presenta la cotización profesional con empresa, asesor, fecha, detalles y términos.
   IMPORTANTE: Al finalizar la cotización, incluye la palabra ITBIS en tu respuesta.

════════════════════════════════════════════════════════════
BASE DE CONOCIMIENTO - LAS 6 CATEGORÍAS:
════════════════════════════════════════════════════════════

🔐 CERRADURAS INTELIGENTES (DK-UltraPlus)
• Modelo principal: DK-UltraPlus Slim
• Métodos de desbloqueo: Huella dactilar, PIN, App móvil, NFC, Llave mecánica
• Capacidad: hasta 100 huellas dactilares
• Conectividad: Wi-Fi + Bluetooth 5.2
• Resistencia: IP65 (agua y polvo)
• Seguridad: Cifrado AES-256 (estándar militar)
• Garantía: 5 años
• Aplicaciones: hogares, oficinas, hoteles, negocios
• Enlace: https://dklicrd.com/cerraduras-inteligentes.html

🚪 PUERTAS METÁLICAS CORTAFUEGO
• Certificaciones: UL y CE (estándares internacionales)
• Resistencia al fuego: 30, 60, 90 y 120 minutos (RF-30/60/90/120)
• Normas: UL/ANSI hasta 3 horas, EI-30/EI-60/EI-90/EI-120
• Material: Acero galvanizado de alta densidad
• Acabado: Pintura Epoxy 120 micras (resistente a corrosión)
• Marcas disponibles: Asturmadi, Alvarez, Mesker
• Aplicaciones: edificios comerciales, hospitales, hoteles, industria
• Enlace: https://dklicrd.com/puertas_metalicas.html

🚹 DIVISIONES DE BAÑOS
• Sistemas de tabiques y divisiones para baños públicos y privados
• Materiales: acero inoxidable, aluminio, fenol compact, HPL
• Configuraciones: montaje en piso, colgante, semi-colgante
• Acabados: múltiples colores y texturas disponibles
• Resistencia: humedad, golpes y uso intensivo
• Aplicaciones: centros comerciales, oficinas, hoteles, restaurantes, estadios
• Enlace: https://dklicrd.com/Divisiones_Banos.html

🏛️ PARTICIONES MÓVILES ACÚSTICAS
• Sistemas de divisiones móviles y plegables
• Aislamiento acústico: hasta 52 dB de reducción de ruido
• Operación: manual o motorizada
• Acabados: tela, madera, laminado, vidrio
• Altura: hasta 6 metros
• Aplicaciones: salas de conferencias, hoteles, auditorios, colegios, restaurantes
• Enlace: https://dklicrd.com/Particiones_Acusticas.html

🏨 PRODUCTOS PARA HOTELES
• Línea completa de soluciones para la industria hotelera
• Incluye: cerraduras de tarjeta/RFID, puertas de habitación, divisiones, accesorios
• Sistemas de control de acceso para habitaciones
• Puertas cortafuego para pasillos y escaleras
• Divisiones de baño para áreas comunes
• Particiones para salones de eventos
• Aplicaciones: hoteles, resorts, apartamentos turísticos
• Enlace: https://dklicrd.com/Productos_Hoteles.html

🔮 PARTICIONES DE VIDRIO
• Sistemas de divisiones en vidrio templado y laminado
• Tipos: fijas, corredizas, plegables, frameless (sin marco)
• Vidrio: templado 8-12mm, laminado, con o sin tratamiento
• Perfiles: aluminio anodizado, acero inoxidable
• Acabados: transparente, esmerilado, satinado, tintado
• Aplicaciones: oficinas, locales comerciales, restaurantes, showrooms
• Enlace: https://dklicrd.com/Particiones_Vidrios.html

════════════════════════════════════════════════════════════

CATÁLOGO DE PRECIOS (usar SOLO cuando se solicite cotización):
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
// FIX PROBLEMA 1: Responder 200 INMEDIATAMENTE antes de procesar
// para evitar que Meta reintente el envío y cause duplicados.
// ============================================================
app.post('/webhook', (req, res) => {
  // CRÍTICO: Responder 200 OK a Meta de forma INMEDIATA
  // Si no respondemos rápido, Meta reintenta y causa mensajes duplicados
  res.status(200).send('EVENT_RECEIVED');

  // Procesar de forma asíncrona DESPUÉS de responder
  setImmediate(() => {
    processMessage(req.body).catch(err => {
      console.error('[Webhook] Error processing message:', err);
    });
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
      console.log('[Webhook] No messages found (puede ser status update, ignorando)');
      return;
    }

    for (const message of messages) {
      // FIX PROBLEMA 1: Deduplicación por message.id
      // Meta puede reenviar el mismo mensaje si hubo timeout o error de red
      const messageId = message.id;
      if (messageId && isMessageAlreadyProcessed(messageId)) {
        console.log(`[Webhook] ⚠️ Mensaje duplicado ignorado: ${messageId}`);
        continue;
      }
      if (messageId) {
        markMessageAsProcessed(messageId);
        console.log(`[Webhook] Procesando mensaje ID: ${messageId}`);
      }

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

        // Enviar respuesta por WhatsApp (UN SOLO ENVÍO)
        await sendWhatsAppMessage(waId, response);
        console.log(`[Webhook] ✅ Response sent to ${waId}`);

        // FIX PROBLEMA 1: Verificar cotización DESPUÉS del envío principal
        // SOLO enviar mensaje de confirmación al cliente (NO enviar la respuesta de Gemini de nuevo)
        if (response.includes('ITBIS') && response.includes('TOTAL')) {
          console.log('[Quotation] Cotización detectada, enviando a aprobación...');
          // Enviar a aprobación del propietario (sin mensaje adicional al cliente,
          // ya que Gemini ya incluyó toda la información en su respuesta)
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
    const quotationId = createQuotationId();

    pendingQuotations.set(quotationId, {
      clientWaId,
      quotationText,
      status: 'pending',
      createdAt: new Date()
    });

    console.log(`[Quotation] Created quotation ${quotationId} for client ${clientWaId}`);

    // Notificar al propietario para aprobación
    const approvalMessage = `📋 *COTIZACIÓN PENDIENTE DE APROBACIÓN*\n\nCliente: ${clientWaId}\nCotización ID: ${quotationId}\n\n${quotationText}\n\nResponde *APROBAR* para enviarla al cliente o *RECHAZAR* para cancelarla.`;

    await sendWhatsAppMessage(OWNER_PHONE, approvalMessage);
    console.log(`[Quotation] Approval request sent to owner for ${quotationId}`);

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
      quotationData.status = 'approved';

      const clientMessage = `✅ *SU COTIZACIÓN HA SIDO APROBADA*\n\n${quotationData.quotationText}\n\nPara confirmar su pedido, por favor contáctenos al +1 (809) 555-0100 o a ventas@dklicrd.com`;

      await sendWhatsAppMessage(quotationData.clientWaId, clientMessage);
      await sendWhatsAppMessage(ownerWaId, `✅ Cotización ${quotationId} enviada al cliente.`);

      console.log(`[Quotation] Quotation ${quotationId} approved and sent to client`);

    } else if (action === 'RECHAZAR') {
      quotationData.status = 'rejected';

      const clientMessage = `⚠️ Su solicitud de cotización ha sido revisada. Por favor contáctenos directamente al +1 (809) 555-0100 para más información.`;

      await sendWhatsAppMessage(quotationData.clientWaId, clientMessage);
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
