# Plan: agente conversacional de registro como proveedor

## 1. Objetivos

Construir desde cero una aplicación independiente que lea los cuatro casos entregados, cruce cada campo con el maestro sin inventar valores, genere los artefactos según el formato, prepare un paquete auditable y converse mediante DeepSeek. El resultado debe poder ejecutarse localmente y, una vez elegido el proveedor de hosting, estar disponible mediante un link durante la defensa.

**Fuente de verdad:** `PRD-01-agente-registro-proveedor 3.md`, especialmente secciones 5–9, y todos los fixtures originales de `reto-01 1/reto-01/`. No hay código, dependencias ni pruebas existentes. No modificar los fixtures originales. Sus soportes son datos ficticios y archivos placeholder, no documentos probatorios reales.

**Fuera de alcance:** envío real de correo, firma electrónica, integración con SharePoint o buzones, automatización de portales, autenticación y roles funcionales, multiusuario y base de datos. La simulación de envío solo crea un archivo. El bonus de módulo reutilizable se implementa únicamente después de cerrar los criterios obligatorios.

**Prioridades y orden:** P0 de punta a punta → P1 → P2 documentado → seguridad y entrega. El objetivo de entrega completa incluye P1 y la salida Markdown de P2, no solo P0. No confundir generación de archivos, estado de campos y `listo_para_firma`.

**Restricciones de partida:** DeepSeek fue elegido por el usuario; el identificador del modelo y el presupuesto están pendientes de confirmar en la cuenta. Hosting, credenciales operativas y acceso a un entorno con almacenamiento persistente están por decidir. No registrar secretos en el plan ni pedirlos por chat.

## 2. Alcance por historia de usuario

| HU | Alcance observable | Dependencias |
|---|---|---|
| HU-1 · Leer solicitud | Validar y leer correo normalizado, descriptor y soportes exigidos; devolver cliente, país, formato, campos y soportes; reconocer etiquetas ambiguas. | Contratos, fixtures y lectura segura. |
| HU-2 · Mapear campos | Cada campo termina exclusivamente en `lleno`, `faltante` o `requiere_confirmacion`, con fuente y valor propuesto cuando exista. Aplicar glosario, umbral y regla tributaria. | HU-1, maestro y reglas. |
| HU-3 · Generar formulario | Excel P0 en celdas exactas; PDF P1 en el orden del descriptor; portal P2 sin automatización, con aviso y Markdown copiable. | HU-2 y generadores por formato. |
| HU-4 · Armar paquete | Preparar formulario o valores para portal, soportes disponibles, checklist, faltantes y correo sin datos bancarios; calcular estado de firma y pedir confirmación antes de simular envío. | HU-1–3, reglas de vigencia y estado de confirmación. |
| HU-5 · Manejar errores | Devolver errores legibles y tipados, conservar progreso y permitir procesar los demás casos; ninguna herramienta propaga excepciones. | Contratos, herramientas, ciclo y API. |

## 3. Decisiones de arquitectura

### 3.1 Componentes y límites

```text
Chat web ──HTTP──> API / sesiones ──> ciclo de agente ──> adaptador DeepSeek
                                      │                └─ proveedor intercambiable
                                      ├─ validación Zod y registro de herramientas
                                      └─ servicios de dominio deterministas
                                           ├─ fixtures originales: solo lectura
                                           └─ out/: artefactos y auditoría
```

1. **Backend y dominio:** TypeScript estricto sobre Node 20+; herramientas importables sin servidor. Alternativa Bun: viable, descartada para el plan base por portabilidad; revisar la versión real de Node admitida por cada dependencia elegida. Funciones cortas, sin `any`.
2. **Frontend:** HTML/CSS/TypeScript simple servido por el mismo backend para reducir complejidad de build y permitir un solo comando. Accesibilidad básica: semántica, foco visible, navegación con teclado, estado anunciado y errores legibles. No introducir un framework sin necesidad demostrada.
3. **DeepSeek:** adaptador propio de chat/tool calls; interfaz interna independiente del proveedor. Usar API compatible con Chat Completions mediante HTTP nativo o SDK ligero justificado; validar soporte y modelo habilitado en la cuenta antes de fijar versión. Conservar `tool_call_id` y mensajes de herramienta; no suponer que el JSON de argumentos es válido. Activar modo no razonador si resulta compatible y simplifica el protocolo; de otro modo preservar los campos exigidos por la API. Referencia consultada: documentación oficial de DeepSeek para tool calls y API de chat. El modelo concreto y sus precios se validarán al implementar; no inventar tarifas.
4. **Repositorio y rutas:** raíz de proyecto en el directorio actual; configurar `fixtures/reto-01` como copia fiel de `reto-01 1/reto-01/` al construir el proyecto, preservando los originales y comprobando equivalencia por hashes. Todas las rutas se resuelven desde `ctx.directory`, sin rutas absolutas codificadas; el identificador de caso se valida contra la lista de carpetas permitidas. Las operaciones solo leen fixtures y solo escriben en `out/`; verificar resolución real y enlaces simbólicos para impedir escapes.
5. **Contrato de herramientas:** `src/tools/proveedor.ts` exporta los cinco objetos requeridos, cada uno con `description`, objeto `args` con esquemas Zod y `.describe()`, y `execute(args, ctx)` que siempre devuelve JSON serializado `{ok:true,data}` o `{ok:false,error}`. Validar en el dispatcher y dentro del límite público de la herramienta, incluidos llamados directos de `demo.ts`. Nombres visibles `proveedor_<export>`. Mantener los campos mínimos del PRD y documentar extensiones.
6. **Dominio determinista:** el LLM orquesta, nunca calcula fuentes, vigencias, estado de firma ni autoriza envío. La lectura, mapeo, comprobación de soportes y generación son servicios tipados probados sin red. Las instrucciones contenidas en solicitudes, documentos o resultados son datos no confiables, no instrucciones del sistema.
7. **Trazabilidad de campos:** cada registro incluye ID estable, etiqueta, ubicación/orden, obligatorio si aplica, estado, ruta de maestro, valor propuesto, confianza y motivo. Coincidencia exacta normalizada del glosario obtiene confianza determinista 1; coincidencia derivada o ambigua no se resuelve automáticamente sin política explícita y queda por debajo de 0,8 / `requiere_confirmacion`; ausencia de fuente es `faltante`. La regla tributaria fuerza confirmación aunque la coincidencia sea exacta. No inventar equivalencias ni permitir que el modelo suministre valores arbitrarios al generador: validar cada mapeo contra los datos canónicos y el caso.
8. **Identificadores y cifras:** conservar identificadores y cuenta como texto, incluidos ceros iniciales. Para RUC/RTN extranjeros usar NIT colombiano como propone RN1, marcado y con nota «identificador extranjero»; nunca afirmar que equivale jurídicamente a un registro local. En ingresos conservar año y moneda originales en el informe sin convertir ni inferir.
9. **Vigencias:** reloj inyectable; fecha de ejecución por defecto con zona horaria configurada y documentada. `vigencia_hasta < fecha_corte` implica vencido; igualdad no vence. `null` significa «sin vencimiento informado», no «actualizado». Comprobar índice y existencia física de cada soporte, sin sustituir tipos. Informar emisor CO y requisitos de antigüedad/actualización que no se puedan verificar; no inventar fecha de expedición ni aceptación extranjera.
10. **Estado de firma:** según RN3, solo un soporte exigido ausente o vencido bloquea `listo_para_firma`; campos faltantes y confirmaciones pendientes se muestran de manera destacada sin alterar ese booleano. Etiquetar claramente que no garantiza completitud jurídica ni aceptación del cliente. Los soportes vencidos que existan se copian y se marcan como vencidos.
11. **Confirmación:** estado de autorización administrado por backend por sesión, caso y acción, con pregunta explícita y confirmación del turno inmediatamente siguiente; se consume una sola vez. `confirmado:true` enviado por el modelo o cliente no basta por sí solo. Rechazo, cambio de caso, mensaje ambiguo, expiración, doble clic o repetición invalidan/no consumen autorizaciones impropias. El resultado solo escribe `ENVIO-SIMULADO.md`; nunca envía. Mantener el contrato `{caso, confirmado}` y reforzarlo con contexto autorizado del servidor; `demo.ts` ejercita la ruta negativa y, si prueba la positiva, crea explícitamente un contexto controlado de prueba.
12. **API y privacidad:** endpoints mínimos `POST /api/chat`, `GET /api/sessions/:id`, `GET /api/health`. Los tool calls deben ser visibles con resumen suficiente; redactar secretos, identificadores y datos bancarios en logs y resúmenes públicos por defecto, preservando la información necesaria en artefactos locales autorizados. Los argumentos originales no se exponen si contienen datos sensibles. En el borrador de correo nunca hay datos bancarios.
13. **Límites de consumo y concurrencia:** máximo de iteraciones por turno configurable, presupuesto de tokens por sesión con reserva conservadora previa y reconciliación con `usage` de DeepSeek, timeout, máximo de tamaño de petición y concurrencia por sesión; fallar cerrado si no se puede garantizar el límite. Añadir límite global/rate limiting y control de acceso a nivel de despliegue para evitar abuso de una clave pública: seguridad técnica, no roles funcionales. Un límite solo por sesión no protege ante sesiones nuevas. Definir presupuesto y controles según hosting; sin ellos, no publicar la clave detrás de un endpoint sin protección.
14. **Salidas y auditoría:** generar de forma atómica, evitar sobrescrituras parciales y serializar operaciones por caso; logs global `out/log.jsonl` y por caso `out/<caso>/log.jsonl` con datos mínimos y sin secretos. Los archivos de sesión no se exponen por rutas estáticas ni mediante `GET /api/sessions/:id` sin el control de acceso del despliegue. En despliegue no asumir que disco efímero persiste; probar y documentar almacenamiento, descarga controlada y tiempo de retención.
15. **Determinismo y limpieza:** demo sobre un directorio `out/` controlado del proyecto, previa comprobación de ruta y rechazo de enlaces/escapes. Solo eliminar ese destino explícito, nunca el proyecto ni fixtures; documentar que borra salidas previas. Inyectar fecha estable para snapshots y fijar metadatos cuando sea viable; verificar contenido semántico de XLSX/PDF, no asumir igualdad binaria por timestamps o IDs internos.
16. **Errores y continuidad:** categorías tipadas para datos inválidos, caso ausente, formato no soportado, IO, proveedor, límite y confirmación; no propagar trazas al usuario. Si el descriptor es corrupto, reportar qué pudo leerse y continuar con lo disponible sin fabricar campos ni prometer generación; un caso malo no detiene los demás.

### 3.2 Decisiones y supuestos que deben quedar explícitos

- Los adjuntos binarios originales no están presentes; se crean XLSX y PDF desde los descriptores. No se promete conservar diseño, fórmulas ni macros originales.
- El descriptor `plantilla-campos.json` también existe para el portal de Panamá aunque la sección 7.1 lo mencione para PDF. Se lee para construir `valores-portal.md`; no se accede al portal.
- El generador de portal devuelve un resultado que informa `formato no soportado` para la automatización y entrega la ruta Markdown. El paquete incluye ese Markdown como representación copiable, no un formulario fingido.
- El correo de Colombia solicita Cámara no mayor a 30 días y RUT actualizado, pero el índice no permite verificar independientemente la fecha de expedición ni actualización. Informar «no verificable» además del cálculo por `vigencia_hasta`.
- Precios y modelo DeepSeek, hosting, límites numéricos, persistencia, protección del link y zona horaria se cierran antes del despliegue; no bloquear la implementación determinista esperando credenciales.
- Referencia técnica consultada para implementar el adaptador: documentación de DeepSeek, `https://api-docs.deepseek.com/guides/tool_calls/` y `https://api-docs.deepseek.com/api/create-chat-completion/`; verificar vigencia y capacidades en la cuenta al implementar.

## 4. Tareas

Las rutas propuestas son relativas a la raíz del proyecto. Las tareas marcadas **[P]** pueden correr en paralelo después de sus dependencias; la integración de cambios compartidos requiere coordinación. No hay estimaciones de duración: el reto no proporciona disponibilidad ni plazo.

### Fase 0 — Preparación y contratos

| # | Tarea ejecutable | Depende de | HU | Archivos |
|---|---|---|---|---|
| 0.1 | Verificar inventario, copiar fixtures sin alterarlos y comparar hashes; fijar raíz y directorio de salida. | — | 1–5 | `fixtures/reto-01/**`, originales `reto-01 1/reto-01/**` solo lectura |
| 0.2 | Inicializar Node/TypeScript estricto, lockfile y scripts reproducibles `dev`, `build`, `lint`, `typecheck`, `test`, `demo`; agregar `.gitignore` y ejemplo de variables sin valores sensibles. | 0.1 | 1–5 | `package.json`, lockfile, `tsconfig.json`, configuración lint/test, `.gitignore`, `.env.example` |
| 0.3 | Definir esquemas Zod de fixtures, entradas, respuestas, mapa de campos y checklist; fijar estados, errores y normalización sin inferencias. | 0.2 | 1, 2, 4, 5 | `src/domain/schemas.ts`, `src/domain/types.ts`, `tests/unit/contracts.test.ts` |
| 0.4 | Establecer catálogo de casos, resolución segura de rutas, reloj y operaciones de IO atómicas con límites y validación de enlaces. | 0.3 | 1, 4, 5 | `src/infra/paths.ts`, `src/infra/files.ts`, `src/domain/clock.ts`, `tests/unit/paths.test.ts` |

**Gate 0:** arranque del proyecto y typecheck pasan; copia de fixtures coincide con originales; contratos, reloj y restricciones de IO probados.

### Fase 1 — Lectura y mapeo P0

| # | Tarea ejecutable | Depende de | HU | Archivos |
|---|---|---|---|---|
| 1.1 | Implementar lector de solicitud, descriptor y lista de soportes, incluyendo portal; conservar diagnóstico parcial cuando un archivo falla. | 0.4 | 1, 5 | `src/domain/reader.ts`, `tests/unit/reader.test.ts` |
| 1.2 | Implementar glosario, acceso seguro a rutas del maestro y mapeo por campo con confianza, fuente, obligatoriedad y trazabilidad. | 1.1 | 2 | `src/domain/mapping.ts`, `tests/unit/mapping.test.ts` |
| 1.3 | Aplicar RN1/RN2, campos ambiguos y representación de confirmaciones; verificar valor y procedencia antes de generar. | 1.2 | 1, 2 | `src/domain/mapping.ts`, `tests/unit/mapping.test.ts` |
| 1.4 | Exponer `leer_solicitud` y `mapear_campos` con contrato exacto y wrapper sin excepciones; probar acceso directo y errores Zod. | 1.3 | 1, 2, 5 | `src/tools/proveedor.ts`, `src/tools/contracts.ts`, `tests/integration/tools-read-map.test.ts` |

**Gate 1:** los 52 campos de los cuatro descriptores están clasificados una sola vez; rutas y fuentes verificables; sin inferencias ni datos bancarios no pedidos.

### Fase 2 — Documentos y paquetes P0/P1/P2

| # | Tarea ejecutable | Depende de | HU | Archivos |
|---|---|---|---|---|
| 2.1 | [P] Seleccionar biblioteca XLSX mantenida y compatible; generar hojas y celdas exactas desde el descriptor, texto preservado y faltantes explícitos. | 1.4 | 3, 5 | `src/domain/generators/xlsx.ts`, `tests/integration/xlsx.test.ts`, `package.json` |
| 2.2 | [P] Seleccionar biblioteca PDF mantenida; generar cada etiqueta/valor en orden, con paginación y manejo visible de faltantes/confirmaciones. | 1.4 | 3, 5 | `src/domain/generators/pdf.ts`, `tests/integration/pdf.test.ts`, `package.json` |
| 2.3 | [P] Generar Markdown de portal con nueve campos y avisos, sin automatización ni credenciales. | 1.4 | 3, 5 | `src/domain/generators/portal.ts`, `tests/integration/portal.test.ts` |
| 2.4 | [P] Inventariar tipos exigidos, existencia física y vigencia; soportar null, límite de fecha, emisor y advertencias de requisitos no verificables. | 1.4 | 4, 5 | `src/domain/supports.ts`, `tests/unit/supports.test.ts` |
| 2.5 | Exponer `generar_formulario`; elegir generador, comprobar mapeo canónico y persistir artefacto atómicamente. | 2.1–2.3 | 3, 5 | `src/tools/proveedor.ts`, `src/domain/generators/index.ts`, `tests/integration/generate.test.ts` |
| 2.6 | Construir paquete coherente: formulario o Markdown, copias de soportes presentes incluso vencidos, checklist con faltantes, correo sin banco y booleano de RN3. | 2.4, 2.5 | 4, 5 | `src/domain/package.ts`, `src/tools/proveedor.ts`, `tests/integration/package.test.ts` |
| 2.7 | Implementar bitácoras global y por caso, estructuradas, sin datos sensibles; pruebas de sanitización y fallo de escritura. | 0.4, 1.4 | 1–5 | `src/infra/audit.ts`, `src/tools/proveedor.ts`, `tests/unit/audit.test.ts` |
| 2.8 | Crear `demo.ts` sin LLM que limpie solo `out/` seguro, procese los cuatro casos de forma independiente, imprima resumen y permita fecha fija de prueba. | 2.6, 2.7 | 1–5 | `demo.ts`, `tests/integration/demo.test.ts` |

**Gate 2:** demo sin clave recorre todos los casos; XLSX reabiertos muestran celdas correctas; PDF se inspecciona por texto y orden; paquete y Markdown coinciden con reglas. Comparar semántica en dos ejecuciones con fecha fija.

### Fase 3 — Agente, DeepSeek y confirmación humana

| # | Tarea ejecutable | Depende de | HU | Archivos |
|---|---|---|---|---|
| 3.1 | Definir interfaz del adaptador y protocolo interno de mensajes, herramientas y `usage`; incorporar stub determinista para pruebas. | 0.3 | 1–5 | `src/llm/adapter.ts`, `tests/helpers/fake-llm.ts` |
| 3.2 | Implementar adaptador DeepSeek con modelo configurable, timeout, validación de respuestas, correlación `tool_call_id`, tratamiento de JSON inválido y consumo de tokens; sin loguear clave. | 3.1 | 1–5 | `src/llm/deepseek.ts`, `src/config.ts`, `tests/integration/deepseek-adapter.test.ts` |
| 3.3 | Definir prompt separado y conocimiento operativo, fuentes permitidas, resistencia a instrucciones en datos y límites; no incorporar valores de fixtures al prompt. | 1.4 | 1–5 | `agent/prompt.md`, `src/knowledge/registro-proveedor.md`, `tests/unit/prompt-policy.test.ts` |
| 3.4 | Implementar dispatcher de herramientas Zod, whitelist, contexto de sesión, serialización y presupuesto de llamadas/tokens. | 2.7, 3.1 | 1–5 | `src/agent/dispatcher.ts`, `src/agent/budget.ts`, `tests/unit/dispatcher.test.ts` |
| 3.5 | Modelar confirmación como estado por sesión/caso/acción con expiración, turno inmediatamente siguiente y consumo único; implementar `simular_envio` y escritura idempotente. | 2.6, 3.4 | 4, 5 | `src/agent/confirmation.ts`, `src/tools/proveedor.ts`, `tests/integration/confirmation.test.ts` |
| 3.6 | Implementar ciclo acotado de modelo → herramientas → modelo, bloqueo de autorización por el modelo, recuperación de errores y respuesta con progreso parcial. | 3.2–3.5 | 1–5 | `src/agent/loop.ts`, `src/agent/session.ts`, `tests/integration/agent.test.ts` |
| 3.7 | Diseñar presentación de resultados fácticos basada en datos canónicos y verificar que respuestas numéricas/identificadores no aparezcan sin fuente; ante divergencia, sustituir o alertar de forma segura. | 3.6 | 1, 2, 4, 5 | `src/agent/presentation.ts`, `tests/integration/grounding.test.ts` |

**Gate 3:** con adaptador falso se cubren varias tool calls, errores, límites y prompt injection; confirmación falsa, ambigua, repetida o cruzada no produce archivo. Prueba real DeepSeek solo con clave disponible; sin ella queda pendiente, no se declara validado el proveedor.

### Fase 4 — API y experiencia conversacional

| # | Tarea ejecutable | Depende de | HU | Archivos |
|---|---|---|---|---|
| 4.1 | Exponer API de chat, historial y health con validación de entrada, respuestas seguras, límites y aislamiento de sesión conforme al contrato. | 3.6 | 1–5 | `src/server.ts`, `src/api/routes.ts`, `tests/integration/api.test.ts` |
| 4.2 | Crear interfaz responsive con historial, entrada, indicador de espera y errores; resaltar estado de confirmación y permitir rechazar. | 4.1 | 1–5 | `web/index.html`, `web/styles.css`, `web/app.ts`, `tests/ui/chat.test.ts` |
| 4.3 | Presentar cada tool call con nombre, argumentos/resultados resumidos y redactados; diferenciar faltantes, confirmaciones, vigencias y ruta de artefactos. | 4.2 | 1–5 | `web/app.ts`, `web/styles.css`, `tests/ui/chat.test.ts` |
| 4.4 | Configurar arranque con un comando, verificación de configuración, protección de secretos y ruta de descarga controlada de artefactos cuando el hosting lo permita. | 4.1–4.3 | 1–5 | `package.json`, `src/server.ts`, `src/api/routes.ts`, `.env.example` |

**Gate 4:** demo conversacional desde navegador con proveedor falso; historial y llamadas visibles, teclado usable, confirmación destacada y sin exposición de secretos. Las descargas y la política de acceso se prueban en el entorno elegido.

### Fase 5 — Calidad, despliegue y entrega

| # | Tarea ejecutable | Depende de | HU | Archivos |
|---|---|---|---|---|
| 5.1 | Ejecutar matriz de casos y pruebas adversariales: traversal, symlinks, JSON corrupto, error de DeepSeek, presupuesto, carreras e inyección de instrucciones. | 4.4 | 1–5 | `tests/unit/**`, `tests/integration/**`, `tests/ui/**` |
| 5.2 | Medir instalación y arranque limpios, revisar dependencias, secretos, cobertura de contratos y repetibilidad de demo; registrar límites observados. | 5.1 | 1–5 | `package.json`, lockfile, configuración de test/lint |
| 5.3 | Elegir hosting con aprobación/accesos disponibles; configurar protección de acceso, cuota global, almacenamiento/retención y variables seguras. Verificar link y descargar artefactos sin acceso cruzado. | 5.2, hosting elegido | 1–5 | configuración del proveedor por definir, `README.md` |
| 5.4 | Documentar arranque, variables, comandos, API, demo, link o limitación; preparar `SOLUCION.md` con los diez apartados obligatorios, costo medido/estimado con tarifas vigentes y declaración real de IA. | 5.2, 5.3 o bloqueo documentado | 1–5 | `README.md`, `SOLUCION.md` |
| 5.5 | Ejecutar defensa de ejemplo Ecuador y los otros tres casos; comprobar contenidos descargables, confirmación humana y estado de soportes con fecha explícita. | 5.4 | 1–5 | `README.md`, `SOLUCION.md`, resultados locales en `out/` excluidos de entrega |
| 5.6 | Bonus opcional: empaquetar agente/skill/herramientas reutilizando la misma fuente sin copias divergentes; comprobar independencia del servidor. | 5.5 | 1–5 | `modulo/agent.md`, `modulo/tools/proveedor.ts`, `modulo/skill/registro-proveedor/SKILL.md` |
| 5.7 | Preparar repositorio o ZIP sin `node_modules/`, `out/`, `.env` ni secretos; incluir lockfile, fixtures requeridos y documentación. No crear commits sin autorización expresa. | 5.4–5.5 | 1–5 | entregable del proyecto |

**Gate 5:** todos los checks aplicables en verde; link accesible y protegido con cuota cuando haya hosting. Si no se logra despliegue, registrar demostración local y penalización prevista de −10 sin afirmar que el requisito de link está cumplido.

## 5. Archivos a cambiar

**En esta etapa de planificación:** solo `PLAN.md` nuevo. Los siguientes son archivos propuestos para una implementación futura, no existen aún salvo los indicados como originales.

- `reto-01 1/reto-01/**`: originales existentes, solo lectura, sin cambios.
- `fixtures/reto-01/**`: copia nueva e íntegra de los 21 fixtures existentes, verificada por hash.
- `package.json`, lockfile, `tsconfig.json`, configuración de lint/test, `.gitignore`, `.env.example`: nuevos; plataforma, scripts, dependencias y configuración sin secretos.
- `agent/prompt.md`, `src/knowledge/registro-proveedor.md`: nuevos; comportamiento y conocimiento separados.
- `src/domain/{schemas,types,clock,reader,mapping,supports,package}.ts`, `src/domain/generators/{index,xlsx,pdf,portal}.ts`: nuevos; contratos y reglas deterministas.
- `src/infra/{paths,files,audit}.ts`, `src/tools/{contracts,proveedor}.ts`: nuevos; IO seguro, logs y cinco herramientas.
- `src/llm/{adapter,deepseek}.ts`, `src/agent/{dispatcher,budget,confirmation,loop,session,presentation}.ts`: nuevos; adaptador, bucle y control de sesión.
- `src/{config,server}.ts`, `src/api/routes.ts`: nuevos; configuración, API y servidor.
- `web/{index.html,styles.css,app.ts}`: nuevos; chat, accesibilidad y visualización de herramientas.
- `tests/unit/**`, `tests/integration/**`, `tests/ui/**`, `tests/helpers/fake-llm.ts`: nuevos; pruebas por capa con fecha y proveedor controlados.
- `demo.ts`: nuevo; recorrido determinista sin modelo. `out/**`: generado localmente, excluido de entrega.
- `README.md`, `SOLUCION.md`: nuevos; operación, decisiones, cobertura, riesgos y diseño de portal.
- `modulo/**`: nuevo solo si se ejecuta el bonus; reutilizar fuentes sin duplicación divergente.
- Configuración de hosting: pendiente de elección; especificar rutas reales después de seleccionar proveedor.

## 6. Riesgos

| Riesgo | Impacto | Señal temprana | Mitigación |
|---|---|---|---|
| Modelo inventa datos o altera mapeo | Registro incorrecto | Respuesta no coincide con ruta de maestro | Mapeo determinista, validación de procedencia, presentación basada en fuentes y pruebas adversariales. |
| RUC/RTN tratado como identidad local | Error legal | Resultado aparece como verificado | NIT propuesto con `requiere_confirmacion`, etiqueta visible y revisión humana. |
| Soportes vencidos o ausentes | Firma prematura | Checklist no coincide con fecha/catálogo | Reloj inyectable, validación física, RN3 y pruebas de bordes. |
| Exigir antigüedad o actualización no verificables | Falsa seguridad | Se concluye «actualizado» sin fecha | Marcar no verificable; no inferir fecha ni aceptación del cliente. |
| Banco o clave expuestos | Privacidad y seguridad | Aparecen en correo, logs, UI o errores | Redacción, minimización, revisión de logs y pruebas con secretos señuelo. |
| Link público permite gastar clave | Costo y abuso | Alto tráfico o sesiones repetidas | Cuota global, rate limit y protección de acceso; presupuesto por sesión; no desplegar sin controles. |
| Traversal o enlaces simbólicos | Lectura/escritura fuera de límites | `caso` o soporte apunta fuera de raíz | Whitelist, resolución de ruta real, directorios controlados y pruebas negativas. |
| Limpieza de `out/` borra datos del usuario | Pérdida de archivos | Ruta de salida alterada o symlink | Limpiar únicamente raíz verificada y documentar la eliminación; rechazar enlaces. |
| Concurrencia o fallo en escritura | Paquete incompleto o corrupción | Dos turnos generan el mismo caso | Bloqueo por caso, temporales, escritura atómica y recuperación comprobada. |
| Credencial/modelo DeepSeek no disponible | Chat real bloqueado | Error de autenticación o modelo inexistente | Adaptador falso para desarrollo; prueba real condicionada a cuenta; reportar bloqueo. |
| Hosting efímero o sin selección | Link o descargas fallan | Archivos desaparecen tras reinicio | Seleccionar almacenamiento apropiado, probar retención; alternativa local con penalización. |
| Restricción de tiempo del reto | Entrega incompleta | P0 sin cerrar cerca de la defensa | Gates P0 primero, P1 después; bonus al final; declarar cobertura real. |
| Cambio de fecha altera resultados | Demo y pruebas inconsistentes | Cámara pasa de vigente a vencida | Fecha de corte inyectable en pruebas y fecha mostrada en producción. |
| Migraciones y compatibilidad | Contrato de artefactos cambia | Clientes esperan esquema anterior | No hay datos persistidos previos ni migración inicial; versionar contratos y documentar compatibilidad futura. |

## 7. Criterios de aceptación y verificación

### 7.1 Matriz de fixtures, fecha fija 2026-11-10

Estos son **resultados esperados**, no pruebas ejecutadas. El comportamiento real debe evaluarse con fecha de ejecución; los ejemplos usan reloj controlado.

| Caso | HU-1/HU-2 | HU-3 | HU-4 |
|---|---|---|---|
| `co-industrias-delta` | 17 campos: 17 llenos; sin confirmar por regla extranjera. | XLSX con 13 campos en `Datos Proveedor` y 4 en `Datos Bancarios`, celdas exactas. | Cuatro soportes presentes; Cámara vencida; `listo_para_firma=false`; antigüedad/actualización no verificable separadamente. |
| `ec-corp-andina` | 15 campos: 13 llenos, RUC en confirmación, contribuyente especial faltante opcional. | PDF con 15 etiquetas en orden. | Cámara vencida y certificado de cumplimiento tributario ausente; `listo_para_firma=false`. |
| `hn-agroexport-sula` | 11 campos: 9 llenos, RTN en confirmación, referencias comerciales faltante; ingresos conservan contexto 2025/COP. | XLSX en `Registro`, celdas exactas; no añadir banco. | Cámara y parafiscales vencidos; `listo_para_firma=false`. |
| `pa-logistica-istmo` | 9 campos: 8 llenos y RUC en confirmación. | Indicar formato portal no soportado y generar `valores-portal.md`; sin acceder al portal. | Cámara vencida; RUT sin vencimiento informado; `listo_para_firma=false`. |

### 7.2 Pruebas verificables por historia

- **HU-1:** caso válido devuelve metadatos, cada campo y soportes; caso inexistente y descriptor corrupto generan error claro y progreso parcial si existe. Descriptor de portal también se lee.
- **HU-2:** cada campo aparece exactamente en un estado; cada valor tiene ruta real del maestro; nombres equivalentes del glosario funcionan; ambiguo y confianza <0,8 requieren confirmación; jamás inventar valores, ni convertir identificadores o monedas.
- **HU-3:** reabrir XLSX y comprobar nombre de cada hoja y par de celdas, incluyendo cadenas con ceros; extraer texto de PDF y verificar orden completo y faltantes; portal genera Markdown sin navegación. No afirmar que se conservó un diseño de archivo original inexistente.
- **HU-4:** checklist distingue ausente, presente, vencido y sin fecha; probar fecha anterior, igual y posterior, archivo faltante en disco, emisor extranjero y ausencia de banco en correo. Confirmar que un campo faltante por sí solo no bloquea RN3 con un fixture aislado. El simulador rechaza sin confirmación y, tras confirmación válida del turno inmediatamente anterior, crea solo `ENVIO-SIMULADO.md`; no hay envío ni firma.
- **HU-5:** las cinco herramientas devuelven string JSON válido, incluso con argumentos inválidos, IO fallido, formato no soportado y datos corruptos. Error de un caso no bloquea otro; errores de proveedor/timeout/límites son legibles y la sesión continúa cuando proceda.
- **Ciclo, UI y seguridad:** nombres, argumentos y resumen de cada llamada aparecen redactados en historial y en ambos logs; `health` no expone secretos; confirmar/rechazar y doble clic respetan el estado; inyección en solicitud no cambia permisos; traversal, symlink y concurrencia no escapan ni corrompen. Verificar límites por sesión y globales en despliegue.
- **DeepSeek:** probar primero con fake las respuestas, múltiples tool calls, JSON inválido, timeouts y contabilidad. Con credencial proporcionada mediante entorno seguro, ejecutar prueba real de extremo a extremo y medir uso; sin credencial dejar prueba pendiente.
- **Entrega:** `SOLUCION.md` cubre diez apartados, portal diseñado, trade-offs, costos basados en tarifas reales y uso de IA; `README.md` incluye ejecución y API. El link real se prueba únicamente cuando haya proveedor; no confundir con prueba local.

### 7.3 Comandos planificados

Los scripts siguientes se crearán en Fase 0 y se ejecutarán al terminar implementación; no existen todavía y no se han corrido:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run demo
npm run dev
```

`npm run demo` debe funcionar sin clave; para su prueba reproducible se inyectará una fecha fija mediante configuración de test. Verificar arranque limpio por debajo de dos minutos en una máquina y red identificadas, e inspeccionar en navegador al menos el caso de ejemplo del PRD. Los tests automáticos no sustituyen la prueba real de DeepSeek, hosting ni revisión de aceptación documental.
