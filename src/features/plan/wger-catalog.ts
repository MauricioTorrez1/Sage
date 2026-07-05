/**
 * Curated map from the Spanish exercise titles Claude generates to wger
 * exercise IDs. wger removed its search API, so matching happens locally;
 * every ID below was verified to exist and to have at least one image.
 * Order matters: first match wins, so more specific patterns go first.
 */
const CATALOG: { pattern: RegExp; exerciseId: number }[] = [
  // Equipment-specific variants first so they win over the generic moves.
  { pattern: /sentadillas?\s+(goblet|con\s+mancuernas?)|goblet/i, exerciseId: 203 },
  { pattern: /sentadillas?\s+frontal(es)?/i, exerciseId: 257 },
  { pattern: /peso\s+muerto\s+rumano/i, exerciseId: 1652 },
  { pattern: /press\s+militar|press\s+de\s+hombros?\s+con\s+barra/i, exerciseId: 566 },
  { pattern: /curl\s+(de\s+)?martillo|martillo/i, exerciseId: 272 },
  { pattern: /tr[ií]ceps/i, exerciseId: 1519 },
  { pattern: /press\s+de\s+(banca|pecho)/i, exerciseId: 73 },
  { pattern: /press\s+(de\s+hombro|militar)/i, exerciseId: 567 },
  { pattern: /prensa\s+de\s+piernas?/i, exerciseId: 371 },
  { pattern: /peso\s+muerto/i, exerciseId: 184 },
  { pattern: /giro\s+ruso|russian\s+twist/i, exerciseId: 1193 },
  { pattern: /puente\s+de\s+gl[úu]teo|hip\s*thrust|elevaci[oó]n\s+de\s+cadera/i, exerciseId: 1642 },
  { pattern: /elevaci[oó]n(es)?\s+de\s+piernas?/i, exerciseId: 377 },
  { pattern: /elevaci[oó]n(es)?\s+laterales?/i, exerciseId: 348 },
  { pattern: /(elevaci[oó]n(es)?\s+de\s+)?(talones|pantorrillas?)/i, exerciseId: 1243 },
  { pattern: /jal[oó]n\s+(al\s+pecho|dorsal)|lat\s*pull/i, exerciseId: 158 },
  { pattern: /swing\s+(con\s+)?(kettlebell|pesa\s+rusa)|kettlebell\s+swing/i, exerciseId: 960 },
  { pattern: /sentadillas?/i, exerciseId: 1801 },
  { pattern: /lagartijas?|flexion(es)?(\s+de\s+(pecho|brazos?))?|push[\s-]?ups?/i, exerciseId: 1551 },
  { pattern: /zancadas?|desplantes?|estocadas?|lunges?/i, exerciseId: 206 },
  { pattern: /planchas?|plank/i, exerciseId: 458 },
  { pattern: /remo/i, exerciseId: 81 },
  { pattern: /curl/i, exerciseId: 1012 },
  { pattern: /abdominales|crunch(es)?/i, exerciseId: 167 },
  { pattern: /(saltos?\s+de\s+)?tijeras?|jumping\s+jacks?/i, exerciseId: 320 },
  { pattern: /fondos|dips/i, exerciseId: 194 },
  { pattern: /dominadas?|pull[\s-]?ups?/i, exerciseId: 475 },
];

/** wger exercise ID for a plan item title, or null when we have no sheet. */
export function findWgerExercise(title: string): number | null {
  const entry = CATALOG.find(({ pattern }) => pattern.test(title));
  return entry?.exerciseId ?? null;
}
