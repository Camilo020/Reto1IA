import { z } from "zod";
import { readCaso } from "../domain/reader.js";
import { mapCampos } from "../domain/mapping.js";
import { generateForm } from "../domain/generators/index.js";
import { buildPackage } from "../domain/package.js";
import { resolveToday } from "../domain/clock.js";
import { mapeoSchema } from "../domain/schemas.js";
import { writeFileAtomic } from "../infra/files.js";
import { safeOutputChild } from "../infra/paths.js";
import { audit } from "../infra/audit.js";
import { safeRun, type ToolContext } from "./contracts.js";

const casoArg = z.string().min(1).describe("Nombre de la carpeta del caso en fixtures/reto-01/casos/");

async function invoke<A extends Record<string, z.ZodType>>(name: string, args: A, raw: unknown, ctx: ToolContext, execute: (value: z.infer<z.ZodObject<A>>, context: ToolContext) => Promise<unknown>): Promise<string> {
  const result = await safeRun({ description: name, args, execute: (value, context) => execute(value as z.infer<z.ZodObject<A>>, context) }, raw, ctx);
  try {
    const caso = typeof raw === "object" && raw !== null && "caso" in raw ? String(raw.caso) : "";
    if (/^[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(caso)) {
      const parsed = JSON.parse(result) as { ok: boolean };
      await audit(ctx.directory, caso, name, parsed.ok, parsed.ok ? "operación completada" : "operación fallida");
    }
  } catch {
    return JSON.stringify({ ok: false, error: "No se pudo registrar la ejecución" });
  }
  return result;
}

export const leer_solicitud = {
  description: "Lee la solicitud, los campos de la plantilla y los soportes exigidos de un caso.",
  args: { caso: casoArg },
  async execute(args: { caso: string }, ctx: ToolContext): Promise<string> {
    return invoke("proveedor_leer_solicitud", this.args, args, ctx, async ({ caso }, context) => {
      const data = await readCaso(context.directory, caso);
      return { pais: data.solicitud.pais, cliente: data.solicitud.cliente, formato: data.solicitud.formato, campos: data.campos, soportes: data.soportes };
    });
  }
};

export const mapear_campos = {
  description: "Cruza los campos solicitados con el maestro; reporta fuentes, faltantes y confirmaciones.",
  args: { caso: casoArg, campos: z.array(z.object({ etiqueta: z.string().min(1) }).passthrough()).describe("Campos obtenidos del descriptor de la solicitud") },
  async execute(args: { caso: string; campos: { etiqueta: string }[] }, ctx: ToolContext): Promise<string> {
    return invoke("proveedor_mapear_campos", this.args, args, ctx, async ({ caso, campos }, context) => {
      const data = await readCaso(context.directory, caso);
      if (campos.length !== data.campos.length || campos.some((item, index) => item.etiqueta !== data.campos[index]?.etiqueta)) {
        throw new Error("Los campos no coinciden con el descriptor original");
      }
      return mapCampos(context.directory, data.solicitud, data.campos);
    });
  }
};

export const generar_formulario = {
  description: "Genera un XLSX, PDF o lista copiable de portal desde los valores verificados del maestro.",
  args: { caso: casoArg, mapeo: mapeoSchema.describe("Mapeo de campos devuelto por proveedor_mapear_campos") },
  async execute(args: { caso: string; mapeo: z.infer<typeof mapeoSchema> }, ctx: ToolContext): Promise<string> {
    return invoke("proveedor_generar_formulario", this.args, args, ctx, async ({ caso, mapeo }, context) => {
      const data = await readCaso(context.directory, caso);
      const canonical = await mapCampos(context.directory, data.solicitud, data.campos);
      if (JSON.stringify(mapeo) !== JSON.stringify(mapeoSchema.parse(canonical))) throw new Error("El mapeo proporcionado no coincide con el maestro");
      return generateForm(data, canonical, context);
    });
  }
};

export const armar_paquete = {
  description: "Arma un paquete con formulario, soportes, checklist y borrador sin datos bancarios.",
  args: { caso: casoArg },
  async execute(args: { caso: string }, ctx: ToolContext): Promise<string> {
    return invoke("proveedor_armar_paquete", this.args, args, ctx, async ({ caso }, context) => {
      const data = await readCaso(context.directory, caso);
      const mapeo = await mapCampos(context.directory, data.solicitud, data.campos);
      return buildPackage(data, mapeo, context, resolveToday(context.today));
    });
  }
};

export const simular_envio = {
  description: "Registra un envío simulado únicamente tras confirmación humana explícita para el caso.",
  args: { caso: casoArg, confirmado: z.boolean().describe("Confirmación humana explícita del turno inmediatamente anterior") },
  async execute(args: { caso: string; confirmado: boolean }, ctx: ToolContext): Promise<string> {
    return invoke("proveedor_simular_envio", this.args, args, ctx, async ({ caso, confirmado }, context) => {
      if (!confirmado || context.authorizedCase !== caso) throw new Error("requiere confirmación explícita");
      const file = await safeOutputChild(context.directory, caso, "ENVIO-SIMULADO.md");
      await writeFileAtomic(file, `# Envío simulado\n\nCaso: ${caso}\n\nNo se envió ningún correo ni se cargaron archivos a portales.\n`);
      return { ruta: `out/${caso}/ENVIO-SIMULADO.md` };
    });
  }
};

export const tools = {
  proveedor_leer_solicitud: leer_solicitud,
  proveedor_mapear_campos: mapear_campos,
  proveedor_generar_formulario: generar_formulario,
  proveedor_armar_paquete: armar_paquete,
  proveedor_simular_envio: simular_envio
};
