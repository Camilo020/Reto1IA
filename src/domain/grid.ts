const cellPattern = /^[A-Z]+[1-9]\d*$/;

export function cellRange(from: string, to: string): string {
  if (!cellPattern.test(from) || !cellPattern.test(to)) throw new Error("Celda inválida");
  return `${from}:${to}`;
}

export function normalizeLabel(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}