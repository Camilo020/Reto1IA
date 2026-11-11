function todayIn(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(new Date());
}

export function resolveToday(override?: string): string {
  if (override) return override;
  return todayIn(process.env.TZ ?? "America/Bogota");
}

export function isExpired(vigenciaHasta: string | null, today: string): boolean {
  if (vigenciaHasta === null) return false;
  return vigenciaHasta < today;
}