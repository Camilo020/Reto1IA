import { cleanDir } from "./src/infra/files.js";
import { outputRoot } from "./src/infra/paths.js";
import { leer_solicitud, mapear_campos, generar_formulario, armar_paquete, simular_envio } from "./src/tools/proveedor.js";

type ToolResponse<T> = { ok: boolean; data?: T; error?: string };

const directory = process.cwd();
const ctx = { directory, sessionId: "demo", today: "2026-11-10" };
const cases = ["co-industrias-delta", "ec-corp-andina", "hn-agroexport-sula", "pa-logistica-istmo"];

await cleanDir(outputRoot(directory));
for (const caso of cases) {
  const read = JSON.parse(await leer_solicitud.execute({ caso }, ctx)) as ToolResponse<{ campos: { etiqueta: string }[] }>;
  if (!read.ok || !read.data) throw new Error(`No se pudo leer ${caso}: ${read.error ?? "sin detalle"}`);
  const map = JSON.parse(await mapear_campos.execute({ caso, campos: read.data.campos }, ctx)) as ToolResponse<unknown>;
  if (!map.ok || !map.data) throw new Error(`No se pudo mapear ${caso}: ${map.error ?? "sin detalle"}`);
  const generated = JSON.parse(await generar_formulario.execute({ caso, mapeo: map.data as never }, ctx)) as ToolResponse<unknown>;
  const packageResult = JSON.parse(await armar_paquete.execute({ caso }, ctx)) as ToolResponse<{ listo_para_firma: boolean; checklist: { bloqueos: string[] } }>;
  const send = JSON.parse(await simular_envio.execute({ caso, confirmado: false }, ctx)) as ToolResponse<unknown>;
  console.log(JSON.stringify({ caso, generado: generated.ok, listo_para_firma: packageResult.data?.listo_para_firma, bloqueos: packageResult.data?.checklist.bloqueos, envio_sin_confirmacion: send.error }, null, 2));
}
