# Solución — agente de registro como proveedor

## 1. Problema en una frase

La analista administrativa repite la transcripción de datos corporativos y el armado de soportes para registros de proveedor; el agente prepara esos entregables de forma trazable, sin reemplazar la firma, el envío ni la decisión humana.

## 2. Arquitectura

```text
Navegador (chat) ──HTTP──> Node/TypeScript API ──> ciclo del agente ──> DeepSeek
                              │                       │
                              │                       └─ herramientas Zod
                              │                              │
fixtures/reto-01 (solo lectura) <────────────────────────────┤
out/ (solo escritura) <──────────────────────────────────────┘
```

- **Prompt:** `agent/prompt.md`. Define comportamiento, límites, confirmación y resistencia a instrucciones en datos externos.
- **Conocimiento:** `src/knowledge/registro-proveedor.md`. Contiene reglas de país, vigencia y límites operativos.
- **Ejecución:** `src/tools/proveedor.ts` y `src/domain/`. Las herramientas son la única fuente de valores que puede afirmar el modelo.
- **Adaptador:** `src/llm/adapter.ts` define la interfaz; `src/llm/deepseek.ts` implementa Chat Completions con tool calls. Cambiar proveedor no cambia el ciclo.
- **Persistencia:** sesiones en memoria; artefactos y logs mínimos en `out/`. No hay base de datos.

El front muestra historial, respuesta, tool calls resumidos, el estado de confirmación y links de descarga. Las rutas de fixtures se resuelven desde la raíz del proyecto; solo se acepta un identificador de caso permitido. `out/` es la única zona de escritura.

## 3. Ciclo del agente

1. El usuario inicia una sesión y envía un mensaje.
2. El backend agrega el prompt del sistema una sola vez y llama al adaptador con definiciones JSON Schema derivadas de Zod.
3. Si DeepSeek pide una herramienta, el dispatcher valida los argumentos, ejecuta la herramienta tipada y agrega un mensaje `tool` con resultado serializado.
4. El ciclo se limita por `MAX_ITERATIONS_PER_TURN`, timeout del proveedor, límite por IP y presupuesto de sesión. Cuando el presupuesto no admite una reserva de próxima llamada, se detiene antes de gastar más.
5. Una pregunta de envío abre una autorización por sesión/caso. Solo una respuesta afirmativa del turno siguiente (`sí`, `confirmo`, `autorizo` o `apruebo`) habilita la herramienta para ese mismo caso y se consume una vez. Un rechazo, ambigüedad, cambio de caso o repetición no autoriza.
6. Las llamadas son visibles en el historial y se dejan registros JSONL globales y por caso. No incluyen secretos; los datos sensibles no aparecen en el borrador de correo.

## 4. Elección del modelo

Se eligió **DeepSeek** por indicación del usuario. El adaptador usa el endpoint compatible con Chat Completions y preserva `tool_call_id`; valida que los argumentos puedan convertirse a objeto antes de la validación Zod. La clave proviene de `DEEPSEEK_API_KEY` y solo se lee en backend.

El modelo por defecto es `deepseek-chat`, configurable con `DEEPSEEK_MODEL`. Antes del despliegue debe validarse en la cuenta activa la disponibilidad del modelo y la tarifa vigente, porque las tarifas y nombres de modelo pueden cambiar. El costo por caso se mide con `usage.total_tokens` que devuelve el proveedor y se calcula con la tarifa vigente en ese momento; no se fija una cifra no verificada en este documento.

Sin clave, se usa `FakeAdapter` para desarrollo, demo de interfaz y pruebas de control de flujo. La integración real queda pendiente de una clave entregada por variable de entorno segura.

## 5. Diseño del portal web

El formato portal no se automatiza en esta entrega. Para `pa-logistica-istmo` se genera `valores-portal.md`, con valores, fuente y estado listos para copiar.

En una fase posterior usaría navegador controlado o RPA limitado a completar campos ya validados. Los límites son CAPTCHA, MFA, cambios de layout, términos de uso y el riesgo de cargar documentos en el cliente incorrecto. Las credenciales se guardarían en un gestor de secretos; las ingresa el humano, nunca el prompt, repositorio, log ni modelo. El humano revisa los valores, inicia sesión, resuelve MFA/CAPTCHA y hace clic en Enviar. El agente no realiza el clic final.

## 6. Decisiones y trade-offs

1. **Dominio determinista antes que relleno por LLM.** Se descartó dejar que el modelo resuelva datos directamente. La ventaja es trazabilidad y que no se inventan valores; el costo es que nuevos sinónimos requieren actualizar el glosario.
2. **XLSX/PDF generados desde descriptores, no plantillas originales.** Los fixtures solo incluyen JSON de celdas/campos, no los binarios. Se descartó afirmar que se conserva formato, macros o AcroForms; se generan artefactos que cumplen etiquetas, orden y posiciones especificadas.
3. **Validación de soportes por catálogo y fecha de ejecución.** `null` no se trata como vigente; se muestra como sin fecha informada. Es conservador y evita afirmar actualización sin evidencia.
4. **Confirmación en estado de servidor.** Se descartó confiar en `confirmado: true` enviado por el modelo o navegador. El servidor liga la autorización a sesión, caso y turno; es más código, pero evita simulación accidental.
5. **Node HTTP y HTML/JS simple.** Se descartó un framework de front para reducir dependencias y arranque; el costo es menos componentes reutilizables si el producto crece.
6. **Disco local para el reto.** Se descartó base de datos porque está fuera del alcance. Un despliegue con filesystem efímero requerirá almacenamiento privado y retención explícita.

## 7. Supuestos

- Los fixtures representan los contratos de entrada del reto y se copian sin modificarse.
- Los archivos de soporte son placeholders ficticios; se validan por índice, existencia y vigencia, no como prueba documental real.
- El identificador tributario del maestro es colombiano. Para RUC/RTN se propone el NIT con estado `requiere_confirmacion`, no como equivalencia jurídica.
- Un campo faltante no bloquea `listo_para_firma`; un soporte ausente o vencido sí, según RN3.
- Las solicitudes colombianas que piden antigüedad/actualización adicional se marcan como no verificables si el fixture no ofrece fecha de expedición.

## 8. Cobertura

| Historia | Estado | Implementación |
|---|---|---|
| HU-1 · Leer solicitud | Hecho | Lectura y validación de solicitud, descriptor y soportes para XLSX, PDF y portal. |
| HU-2 · Mapear campos | Hecho | Glosario, ruta de maestro, estados excluyentes, procedencia, confianza y regla RUC/RTN. |
| HU-3 · Generar formulario | Hecho | XLSX con celdas/hojas, PDF ordenado y Markdown para portal. |
| HU-4 · Armar paquete | Hecho | Copias de soportes, checklist, borrador sin banco, logs y envío simulado con confirmación. |
| HU-5 · Errores | Hecho | Respuestas JSON seguras, errores legibles, controles de ruta y continuación por caso. |
| Link público | Pendiente | Falta elegir proveedor y configurar controles de despliegue. |
| Prueba DeepSeek real | Pendiente | Requiere clave en entorno; el adaptador y protocolos se prueban con fake. |

Las pruebas cubren cuatro casos de fixtures, clasificación, vigencias a fecha fija, celdas XLSX, PDF, portal, paquetes, error de caso, traversal, API local, tool calls, envío denegado, autorización de un uso y repetición denegada. No cubren facturación/latencia real de DeepSeek, disponibilidad del hosting ni aceptación documental de un cliente real.

## 9. Uso de IA

Se usó PERXIA como asistente de ingeniería para analizar el PRD y fixtures, diseñar la arquitectura, generar una implementación inicial, revisar errores de compilación y construir pruebas. Se descartaron propuestas que asumían soportes reales, afirmaban validez transfronteriza, trataban `null` como vigente o confiaban en el flag de confirmación del modelo. Todo el código entregado fue revisado mediante typecheck, lint, tests, build y demo local.

## 10. Riesgos de producción y mitigación

| Riesgo | Mitigación |
|---|---|
| Alucinación o argumento inválido del modelo | Herramientas como única fuente, schemas Zod, mapeo canónico y verificación antes de generar. |
| Exposición o costo de la clave | Variable de entorno de servidor, límite por IP/sesión, timeout, access gate opcional y no publicar sin controles. |
| Datos bancarios en logs o correos | Borrador sin banco, resúmenes reducidos y revisión de logs antes de producción. |
| Path traversal / symlinks | Whitelist de caso, `realpath`, validación de enlaces y rutas de salida controladas. |
| Almacenamiento efímero en hosting | Usar bucket privado/encriptado o volumen persistente; definir retención y descargas autorizadas. |
| Documentos o reglas por país cambian | Dueño del maestro y del glosario, validación legal/administrativa y versionado de reglas. |
| Portales con MFA/CAPTCHA | Humano inicia sesión, resuelve retos y realiza envío; agente solo prepara valores. |
| Concurrencia de generación | Añadir lock por caso y almacenamiento transaccional antes de escalar a multiusuario. |

## Despliegue pendiente

Antes de publicar: elegir proveedor, usar variables seguras, definir `ACCESS_TOKEN`, validar rate limit detrás de proxy, usar almacenamiento privado/no efímero, fijar retención, habilitar HTTPS, restringir CORS al dominio real y ejecutar un flujo con una clave DeepSeek de prueba. Sin esos controles, la entrega debe ejecutarse localmente para no exponer la clave.