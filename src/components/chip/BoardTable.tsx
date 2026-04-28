import Link from 'next/link';
import type { ChipBoard } from '@/lib/queries/chip';

type Props = {
  boards: ChipBoard[];
  chipName: string;
};

/* ────────────────────────────────────────────────────────────────────────
   Board name extraction (v3 — tokenize-and-filter)

   Background. canonical_name is a noisy free-text field. SKUs may sit
   inside parens at the end, after a ' - ' separator, or buried mid-string
   between spec tokens. v1's strip-from-end approach worked for ~40% of
   real boards — anything where the SKU was inside the spec dump came out
   uncleaned.

   v3 strategy:
     1. Pull SKU from trailing parens if present.
     2. Cut at first ' - ' (the spec-dump separator).
     3. Strip the chip name (passed as context) from anywhere.
     4. Strip leading "GeForce" / "Radeon" / "Arc" remnants.
     5. Strip multi-word spec phrases (PCI Express N.N, RDNA N, DLSS N).
     6. Tokenize on whitespace.
     7. If no SKU yet, find the longest run of consecutive SKU-shaped
        tokens anywhere in the token list (handles single-token SKUs and
        space-separated multi-token SKUs equally).
     8. Filter remaining tokens against a junk-spec-token allow-list.
     9. Reassemble. Truncate at 80 chars; fall back to truncated full
        name if we stripped to nothing.

   Misfires fall back to a tooltip with the full text. The full board page
   at /p/[slug] also shows the full canonical name. No information is
   hidden, only de-emphasized. Re-evaluate when display_name is backfilled
   (Architecture Bible §10 tail / §12 deferred).
   ──────────────────────────────────────────────────────────────────────── */

// Multi-word spec phrases stripped before tokenization. Order matters —
// stricter patterns first so the looser ones don't pre-eat their prefixes.
const PHRASE_STRIPS: RegExp[] = [
  /\bPCI\s+Express\s+\d+(?:\.\d+)?(?:\s*x\d+)?\b/gi,
  /\bPCIe\s+\d+(?:\.\d+)?(?:\s*x\d+)?\b/gi,
  /\bPCI-Express\s+\d+(?:\.\d+)?(?:\s*x\d+)?\b/gi,
  /\bRDNA\s+\d+\b/gi,
  /\bDLSS\s+\d+(?:\.\d+)?\b/gi,
  /\bRay\s+Tracing\b/gi,
  /\bG-?SYNC\b/gi,
  /\bHDMI\s+\d+(?:\.\d+[a-z]?)?\b/gi,
  /\bDisplayPort\s+\d+(?:\.\d+[a-z]?)?\b/gi,
  /\bUSB\s+Type-C\b/gi,
];

// Single-token junk patterns. Tested with `^...$` against each token.
const JUNK_TOKEN_PATTERNS: RegExp[] = [
  /^\d+G$/i, // 32G
  /^\d+GB$/i, // 32GB, 16GB
  /^GDDR\d+X?$/i, // GDDR6, GDDR6X, GDDR7
  /^DDR\d+$/i, // DDR6
  /^x\d+$/i, // x16
  /^\d+-?bit$/i, // 384-bit, 512bit, 256-Bit
  /^\d+(?:\.\d+)?[a-z]?$/i, // 5.0, 2.1a, 2.1b, 4.0
  /^\d+MHz$/i,
  /^\d+W$/i,
  /^DLSS$/i,
  /^HDMI$/i,
  /^DisplayPort$/i,
  /^DP$/i,
  /^ATX$/i,
  /^Mini-ITX$/i,
  /^PCI$/i,
  /^PCIe$/i,
  /^PCI-Express$/i,
  /^PCI-E$/i,
  /^Express$/i,
  /^Graphics$/i,
  /^Video$/i,
  /^Cards?$/i,
  /^RDNA\d*$/i,
  /^TGP$/i,
  /^Boost$/i,
];

// Tokens that look like product SKUs: starts with uppercase, followed by
// uppercase letters/digits/hyphens, includes at least one hyphen, ≥5
// chars total. Examples: GV-N5090GAMING, OC-32GD, TUF-RTX5090-32G-GAMING.
function isSkuLikeToken(t: string): boolean {
  if (t.length < 5) return false;
  if (!t.includes('-')) return false;
  return /^[A-Z][A-Z0-9-]+$/.test(t);
}

function isJunkToken(t: string): boolean {
  return JUNK_TOKEN_PATTERNS.some((r) => r.test(t));
}

function extractBoardName(
  fullName: string,
  chipName: string,
): { short: string; sku: string | null; full: string } {
  const full = fullName.trim();
  let s = full;
  let sku: string | null = null;

  // 1. Parenthesized SKU at end
  const parenMatch = s.match(/^(.*?)\s*\(([^()]{4,})\)\s*$/);
  if (parenMatch) {
    sku = parenMatch[2].trim();
    s = parenMatch[1].trim();
  }

  // 2. Cut at first ' - '
  const dashIdx = s.indexOf(' - ');
  if (dashIdx > 0) s = s.slice(0, dashIdx).trim();

  // 3. Strip chip name (case-insensitive, word-bounded)
  if (chipName) {
    const escaped = chipName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp('\\b' + escaped + '\\b', 'i'), '');
  }

  // 4. Strip leading GeForce/Radeon/Arc remnants
  s = s.replace(/\b(GeForce|Radeon|Arc)\b/gi, '');

  // 5. Multi-word phrase strips
  for (const r of PHRASE_STRIPS) s = s.replace(r, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // 6. Tokenize
  const tokens = s.split(/\s+/).filter(Boolean);

  // 7. Find longest SKU-shaped run if no parens-SKU was extracted
  if (!sku) {
    let bestStart = -1;
    let bestEnd = -1;
    let bestChars = 0;
    let i = 0;
    while (i < tokens.length) {
      if (isSkuLikeToken(tokens[i])) {
        let j = i;
        let chars = 0;
        while (j < tokens.length && isSkuLikeToken(tokens[j])) {
          chars += tokens[j].length;
          j++;
        }
        if (chars > bestChars) {
          bestStart = i;
          bestEnd = j;
          bestChars = chars;
        }
        i = j;
      } else {
        i++;
      }
    }
    if (bestStart >= 0) {
      sku = tokens.slice(bestStart, bestEnd).join(' ');
      tokens.splice(bestStart, bestEnd - bestStart);
    }
  }

  // 8. Filter junk tokens
  const cleanTokens = tokens.filter((t) => !isJunkToken(t));

  // 9. Reassemble + truncate
  let short = cleanTokens.join(' ').trim();
  if (short.length > 80) short = short.slice(0, 77).trim() + '…';
  if (short.length < 3) {
    short = full.length > 80 ? full.slice(0, 77).trim() + '…' : full;
  }

  return { short, sku, full };
}

/* ──────────────────────────────────────────────────────────────────────── */

function formatPrice(n: number, currency: string = 'CAD'): string {
  return `$${n.toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = 60_000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < h) return `${Math.max(1, Math.round(diff / m))}m ago`;
  if (diff < d) return `${Math.round(diff / h)}h ago`;
  const days = Math.round(diff / d);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/* ──────────────────────────────────────────────────────────────────────── */

export default function BoardTable({ boards, chipName }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      {/* Desktop column header. Hidden on mobile — each row is a card
          with its own labeled cells. */}
      <div className="hidden grid-cols-[minmax(0,1fr)_140px_90px_90px] items-center gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:grid dark:border-zinc-800 dark:bg-zinc-900/50">
        <div>Board</div>
        <div className="text-right">Lowest price</div>
        <div className="text-right">Retailers</div>
        <div className="text-right">Last seen</div>
      </div>

      <ul>
        {boards.map((board) => (
          <BoardRow key={board.id} board={board} chipName={chipName} />
        ))}
      </ul>
    </div>
  );
}

function BoardRow({
  board,
  chipName,
}: {
  board: ChipBoard;
  chipName: string;
}) {
  const { short, sku, full } = extractBoardName(board.name, chipName);
  const hasPrice = board.lowestPrice != null;

  // Most-recent observation across the board's listings, regardless of
  // whether it has a current price. Falls back to last_seen if no
  // observation timestamp is available. Drives the "Last seen" cell.
  const seenAt = board.listings.reduce<string | null>((acc, l) => {
    const candidate = l.lastObservedAt ?? l.lastSeen;
    if (!candidate) return acc;
    if (!acc || candidate > acc) return candidate;
    return acc;
  }, null);

  return (
    <li className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/50">
      <Link
        href={`/p/${board.slug}`}
        title={full}
        className="block px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
      >
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_140px_90px_90px] sm:items-center sm:gap-4">
          {/* Name + SKU. Truncates with title tooltip; SKU monospaced
              underneath. */}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {short}
            </div>
            {sku && (
              <div className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                {sku}
              </div>
            )}
          </div>

          {/* Mobile: cells flow inline with labels.
              Desktop: each cell becomes a direct grid child via
              `sm:contents`. */}
          <div className="flex items-baseline justify-between gap-4 text-sm sm:contents">
            <div className="sm:text-right">
              <span className="mr-2 text-xs uppercase tracking-wide text-zinc-500 sm:hidden">
                Lowest
              </span>
              <span
                className={`tabular-nums ${
                  hasPrice
                    ? 'font-semibold text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-400'
                }`}
              >
                {hasPrice
                  ? formatPrice(
                      board.lowestPrice!,
                      board.lowestPriceCurrency ?? 'CAD',
                    )
                  : '—'}
              </span>
            </div>

            <div className="sm:text-right">
              <span className="mr-2 text-xs uppercase tracking-wide text-zinc-500 sm:hidden">
                Retailers
              </span>
              <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                {board.retailerCount > 0 ? board.retailerCount : '—'}
              </span>
            </div>

            <div className="sm:text-right">
              <span className="mr-2 text-xs uppercase tracking-wide text-zinc-500 sm:hidden">
                Last seen
              </span>
              <span className="tabular-nums text-zinc-500">
                {formatRelative(seenAt)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
