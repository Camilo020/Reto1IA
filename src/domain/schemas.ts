import { z } from "zod";

export const solicitudSchema = z.object({
  id: z.string().min(1),
  de: z.string(),
  para: z.string().optional(),
  asunto: z.string(),
  fecha: z.string(),
  pais: z.string(),
  cliente: z.string(),
  formato: z.enum(["xlsx", "pdf", "portal"]),
  cuerpo: z.string(),
  adjuntos: z.array(z.string())
});

export const celdaSchema = z.object({
  hoja: z.string().min(1),
  celda_etiqueta: z.string().regex(/^[A-Z]+[1-9]\d*$/),
  etiqueta: z.string().min(1),
  celda_valor: z.string().regex(/^[A-Z]+[1-9]\d*$/)
});

export const campoSchema = z.object({
  etiqueta: z.string().min(1),
  obligatorio: z.boolean()
});

export const soporteSchema = z.object({
  tipo: z.string().min(1),
  archivo: z.string().min(1),
  vigencia_hasta: z.string().nullable(),
  pais_emisor: z.string(),
  descripcion: z.string()
});

export const mapeoCampoSchema = z.object({
  id: z.string(),
  etiqueta: z.string(),
  estado: z.enum(["lleno", "faltante", "requiere_confirmacion"]),
  ruta_maestro: z.string().nullable(),
  valor: z.string().nullable(),
  confianza: z.number().min(0).max(1),
  motivo: z.string().nullable(),
  obligatorio: z.boolean().optional(),
  hoja: z.string().optional(),
  celda_etiqueta: z.string().optional(),
  celda_valor: z.string().optional(),
  orden: z.number().int().min(0),
  contexto: z.string().optional()
});

export const mapeoSchema = z.object({
  llenos: z.array(mapeoCampoSchema),
  faltantes: z.array(mapeoCampoSchema),
  requiere_confirmacion: z.array(mapeoCampoSchema)
});

export type Solicitud = z.infer<typeof solicitudSchema>;
export type Celda = z.infer<typeof celdaSchema>;
export type Campo = z.infer<typeof campoSchema>;
export type Soporte = z.infer<typeof soporteSchema>;
export type MapeoCampo = z.infer<typeof mapeoCampoSchema>;
export type Mapeo = z.infer<typeof mapeoSchema>;
export type Formato = Solicitud["formato"];
export type Descriptor = Celda[] | Campo[];
export type Caso = { solicitud: Solicitud; campos: (Celda | Campo)[]; soportes: string[] };
export type ToolContext = { directory: string; sessionId: string; authorizedCase?: string; today?: string };
export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: string; data?: unknown };

export function fechaISO(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
