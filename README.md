# WhatsApp Webhook - DKLIC PLUS INVESTMENT

Servidor simple de WhatsApp Business para cotizaciones de puertas cortafuego.

## Despliegue en Render.com

### Build Command
```
npm install
```

### Start Command
```
node server.js
```

### Variables de Entorno Requeridas

| Variable | Descripción |
|----------|-------------|
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono de WhatsApp Business |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID de la cuenta de WhatsApp Business |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso de la API de WhatsApp |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación del webhook (ej: `grupo_arboleda_2026`) |
| `GEMINI_API_KEY` | API Key de Google Gemini |
| `PORT` | Puerto del servidor (Render lo configura automáticamente) |

### URL del Webhook

Una vez desplegado en Render, la URL del webhook será:
```
https://TU-SERVICIO.onrender.com/webhook
```

### Configuración en Meta for Developers

1. Ve a [Meta for Developers](https://developers.facebook.com)
2. Selecciona tu app → WhatsApp → Configuration
3. En "Webhook", haz clic en "Edit"
4. Ingresa la URL: `https://TU-SERVICIO.onrender.com/webhook`
5. Ingresa el Verify Token: `grupo_arboleda_2026`
6. Haz clic en "Verify and Save"
7. Suscríbete al evento: `messages`

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar servidor
node server.js
```

## Estructura

```
server.js       - Servidor principal (todo en un archivo)
package.json    - Dependencias y scripts
.env.example    - Plantilla de variables de entorno
README.md       - Documentación
```
