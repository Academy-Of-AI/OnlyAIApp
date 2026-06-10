/** Max characters stored for a build_prompt / pasted plan. Generous — a real PRD
 *  can be tens of KB. (The AI prompt itself is capped separately in plan-pack.) */
export const MAX_BUILD_PROMPT = 50000;

// Reverse of the Windows-1252 0x80–0x9F block: the Unicode chars cp1252 produces
// for those bytes (€ † ' ' " " – — … ™ etc.) mapped back to their byte value.
// Needed because real-world mojibake is cp1252-decoded UTF-8, so the broken
// string contains chars >255 (e.g. "→" → "â†'", where † is U+2020 and ' is U+2019).
const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/** Re-interpret a string's chars as cp1252 bytes and decode them as UTF-8 —
 *  reversing "mojibake" (UTF-8 once decoded as Windows-1252: "→"→"â†'",
 *  "·"→"Â·", "é"→"Ã©"). Bails to the input if a char isn't a cp1252 byte. */
function cp1252ToUtf8(s: string): string {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0xff) bytes[i] = c;
    else if (CP1252_HIGH[c] !== undefined) bytes[i] = CP1252_HIGH[c];
    else return s; // a genuine non-cp1252 unicode char → not simple mojibake
  }
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return s;
  }
}

const MOJIBAKE_RE = /Ã.|â€|â†|â‰|Â[\s·©®°±µ½¼¾]/g;

function mojibakeScore(s: string): number {
  return (s.match(MOJIBAKE_RE) || []).length;
}

/**
 * Repair common mojibake (UTF-8 mis-decoded as Windows-1252). Deliberately
 * conservative: only acts when a strong signature is present AND the repair
 * strictly reduces that signature without introducing replacement chars (�) —
 * so clean text (including legitimate accents/emoji) is never touched. Idempotent.
 */
export function fixMojibake(s: string | null | undefined): string {
  const str = s ?? "";
  MOJIBAKE_RE.lastIndex = 0;
  if (!MOJIBAKE_RE.test(str)) return str;
  const fixed = cp1252ToUtf8(str);
  if (fixed === str || fixed.includes("�")) return str;
  return mojibakeScore(fixed) < mojibakeScore(str) ? fixed : str;
}
