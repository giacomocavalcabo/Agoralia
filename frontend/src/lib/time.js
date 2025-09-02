// Uso solo Web Intl; niente lib pesanti
export function formatInTz(isoUtc, tz, opts = {}) {
  if (!isoUtc) return "";
  const date = typeof isoUtc === "string" ? new Date(isoUtc) : isoUtc;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz || "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  }).format(date);
}

// Converte una LocalDateTime (utente) -> ISO UTC per salvare su backend
export function localPartsToUtcIso({ year, month, day, hour, minute }, tz) {
  // month: 1-12
  const dtLocal = new Date(Date.UTC(year, month - 1, day, hour, minute));
  // Hack robusto: calcolo l'offset della tz rispetto a UTC in quel momento,
  // usando formatToParts per estrarre l'ora “vista” nella tz, poi correggo.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || "UTC",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(dtLocal).map(p => [p.type, p.value]));
  const localAsSeen = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour, 10),
    parseInt(parts.minute, 10)
  );
  // “localAsSeen” è l’istante UTC corrispondente a quei campi in tz ⇒ ISO
  return new Date(localAsSeen).toISOString();
}

// Utility per scegliere la tz “effettiva” dell’utente nel contesto workspace
export function effectiveTz(user, workspace) {
  return user?.tz || workspace?.timezone || "UTC";
}
