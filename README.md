# Endeavor · Formulario de solicitud de videos

Formulario de intake que se conecta al workflow de n8n para el agente generador de videos.

## Archivos

```
├── index.html   — estructura del formulario
├── style.css    — estilos (tokens, componentes, responsive)
├── main.js      — lógica, validación y conexión al webhook de n8n
└── README.md
```

## Setup rápido

### 1. Configurar el webhook de n8n

Abrí `main.js` y reemplazá la URL en la línea 5:

```js
const CONFIG = {
  N8N_WEBHOOK_URL: 'https://TU_INSTANCIA_N8N.com/webhook/video-request',
  ...
};
```

La URL la encontrás en n8n: nodo **"Webhook — Formulario de solicitud"** → copiar URL de producción.

### 2. Habilitar CORS en n8n

El webhook de n8n necesita aceptar requests desde GitHub Pages.
En el nodo Webhook, en **Settings → Allowed Origins** agregá:

```
https://TU_ORG.github.io
```

O para desarrollo local: `http://localhost:*`

### 3. Desplegar en GitHub Pages

```bash
# Crear repo y subir archivos
git init
git add .
git commit -m "Initial: Endeavor video request form"
git remote add origin https://github.com/TU_ORG/endeavor-video-form.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source → main branch → / (root)** → Save.

La URL del formulario queda: `https://TU_ORG.github.io/endeavor-video-form/`

## Qué envía el formulario al webhook

El formulario hace un `POST` con `multipart/form-data` con estos campos:

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | string | Nombre completo del solicitante |
| `email` | string | Email @endeavor.org |
| `oficina` | string | Slug de la oficina (ej. `argentina`) |
| `equipo` | string | Equipo o programa |
| `tipo_video` | string | `avatar` \| `animado` \| `mixto` |
| `audiencia` | string | Segmento objetivo |
| `duracion` | string | `1-2min` \| `3-5min` \| `5min+` |
| `conceptos` | string | Ideas y frases clave a destacar |
| `documento_url` | string | URL del doc (si no se subió archivo) |
| `archivo` | File | Archivo adjunto (PDF/Word/TXT, max 20MB) |
| `solicitud_id` | string | ID generado en el cliente (ej. `SOL-1719600000123`) |
| `timestamp` | string | ISO 8601 del momento del envío |

## Respuesta esperada del webhook

El formulario espera un JSON con al menos:

```json
{ "ok": true, "solicitud_id": "SOL-1719600000123" }
```

Si el webhook responde con un status ≥ 400, muestra un toast de error.

## Desarrollo local

```bash
# Con Python
python3 -m http.server 8080

# Con Node
npx serve .
```

Abrí `http://localhost:8080` en el browser.

## Política de IA

Este formulario activa un agente de IA de Endeavor. Uso sujeto a la
[Política de IA de Endeavor](https://oneendeavor.notion.site/Endeavor-AI-Policy-1d6bd9fe4dd680fe929ece53a9850c24).
El disclaimer está incluido en el formulario y es obligatorio mantenerlo visible.
