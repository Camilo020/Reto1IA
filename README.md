# Registro como proveedor — agente conversacional

Agente que automatiza el llenado de formularios de registro como proveedor: lee la solicitud de un cliente, cruza cada campo con el repositorio maestro sin inventar valores, genera el formulario en el formato pedido (Excel, PDF o valores para portal), arma el paquete con soportes y un borrador de correo, y pide confirmación humana antes de cualquier envío. Nunca firma ni envía información real.

## Requisitos

- Node.js 20 o superior (probado con Node 22).
- Una clave de DeepSeek solo si vas a usar el chat con el modelo real (`DEEPSEEK_API_KEY`).

## Arranque en local (un comando)

```bash
npm install
npm run dev
```

Abre `http://localhost:8787`. La aplicación funciona **sin clave** con un adaptador determinista (`LLM_PROVIDER=fake`), útil para revisar la interfaz. Para el chat con el modelo real copia `.env.example` a `.env` y define `DEEPSEEK_API_KEY`.

## Verificación sin modelo

```bash
npm run demo
```

Recorre los cuatro casos llamando directamente a las herramientas, limpia `out/` al inicio e imprime por caso si se generó, si quedó `listo_para_firma` y qué soportes bloquean. No requiere clave.

## Variables de entorno

| Variable | Descripción | Por defecto |
|---|---|---|
| `DEEPSEEK_API_KEY` | Clave del proveedor. Solo backend; nunca en front ni logs. | — (usa el adaptador fake) |
| `DEEPSEEK_BASE_URL` | URL base de la API compatible con Chat Completions. | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Modelo a usar. | `deepseek-chat` |
| `LLM_PROVIDER` | `deepseek` o `fake`. | `deepseek` |
| `PORT` | Puerto del servidor. | `8787` |
| `TZ` | Zona horaria para la fecha de vigencia. | `America/Bogota` |
| `MAX_ITERATIONS_PER_TURN` | Tope de iteraciones del agente por turno. | `25` |
| `MAX_TOKENS_PER_SESSION` | Presupuesto de tokens por sesión. | `200000` |
| `LLM_TIMEOUT_MS` | Tiempo máximo por llamada al proveedor. | `60000` |
| `RATE_LIMIT_PER_MINUTE` | Límite de peticiones por minuto e IP. | `30` |
| `ACCESS_TOKEN` | Contraseña opcional del link. Si se define, la interfaz pide acceso. | — |

## API

| Método | Ruta | Cuerpo / respuesta |
|---|---|---|
| `POST` | `/api/chat` | `{ sessionId, message }` → `{ ok, reply, toolCalls[], needsConfirmation }` |
| `GET` | `/api/sessions/:id` | Historial de la sesión. |
| `GET` | `/api/health` | `{ ok, provider, model }`, sin claves. |
| `GET` | `/api/files/:caso/:archivo` | Descarga controlada de un artefacto dentro de `out/<caso>/`. |

Con `ACCESS_TOKEN` definido, primero se autentica con `POST /api/access` enviando el token en `Authorization`; el servidor responde con una cookie `HttpOnly`.

## Herramientas

Todas viven en `src/tools/proveedor.ts`, se validan con Zod y devuelven JSON `{ ok, data }` o `{ ok: false, error }` sin lanzar excepciones: `proveedor_leer_solicitud`, `proveedor_mapear_campos`, `proveedor_generar_formulario`, `proveedor_armar_paquete` y `proveedor_simular_envio`.

## Estructura

- `agent/prompt.md`: comportamiento del agente.
- `src/knowledge/`: conocimiento del proceso.
- `src/domain/`: lectura, mapeo, soportes, paquete y generadores deterministas.
- `src/tools/`, `src/agent/`, `src/llm/`, `src/api/`, `src/server.ts`: herramientas, ciclo, adaptador, API y servidor.
- `fixtures/reto-01/`: copia íntegra de los datos entregados (solo lectura).
- `out/`: artefactos y bitácoras generados; no se versiona.
- `demo.ts`: verificación sin modelo.

## Comandos de calidad

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Link de prueba

Pendiente de elegir proveedor de hosting. Ver la sección de despliegue en `SOLUCION.md` (requisitos de protección, cuota y almacenamiento). Mientras no exista link, la defensa se hace con la ejecución local anterior.