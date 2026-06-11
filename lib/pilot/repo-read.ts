import { githubClient } from "@/lib/github";

/**
 * Read a GitHub repo, READ-ONLY and budgeted, into a digest the Pilot can audit
 * and reverse-engineer a draft plan from.
 *
 * Hard rule for the existing-repo feature: we NEVER write to the user's repo.
 * This only lists the tree and downloads a budgeted slice of source files —
 * enough signal for the objective-standards audit (rules.ts) and for the AI to
 * sketch a draft plan, without pulling the whole repo (cost + the 5-min limit).
 */

export interface RepoFile {
  path: string;
  content: string;
}

export interface RepoDigest {
  fullName: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  topics: string[];
  /** Every code path in the tree (for structure inference), capped. */
  tree: string[];
  /** The budgeted slice we actually downloaded + scanned. */
  files: RepoFile[];
  treeTruncated: boolean;
  filesTruncated: boolean;
}

const MAX_FILES = 40;          // how many files we download
const MAX_FILE_BYTES = 24_000; // skip anything bigger (vendored/minified)
const MAX_TREE = 600;          // cap the structure list

// What we read, in priority order. Anchor files first (cheap, high-signal),
// then a sample of routes/components where the drift rules actually fire.
const ANCHORS = [
  "package.json", "README.md", "readme.md", "README.mdx",
  "next.config.js", "next.config.ts", "next.config.mjs",
  ".env.example", "docs/TASKS.md", "docs/PLAN.md", "CLAUDE.md",
];
const CODE_RE = /\.(tsx|ts|jsx|js)$/;
const CODE_DIR_RE = /^(app|src|pages|components|lib)\//;
const SKIP_RE = /(^|\/)(node_modules|\.next|dist|build|\.git)\//;

/** Pick the budgeted set of paths to download from the full tree. */
function selectPaths(tree: string[]): string[] {
  const present = new Set(tree);
  const picked: string[] = [];
  const add = (p: string) => { if (!picked.includes(p)) picked.push(p); };

  for (const a of ANCHORS) if (present.has(a)) add(a);

  // Prefer route handlers + server actions (where #1/#3 live), then components
  // + lib (where #9 lives). Stable order so the same repo reads the same way.
  const code = tree
    .filter((p) => CODE_RE.test(p) && CODE_DIR_RE.test(p) && !SKIP_RE.test(p))
    .sort((a, b) => {
      const score = (p: string) =>
        (/route\.(ts|js)$/.test(p) || /actions\.(ts|js)$/.test(p) ? 0 : 1) * 10 +
        (/\/(components|app)\//.test(p) ? 1 : 2);
      return score(a) - score(b) || a.length - b.length;
    });

  for (const p of code) { if (picked.length >= MAX_FILES) break; add(p); }
  return picked.slice(0, MAX_FILES);
}

export async function fetchRepoDigest({
  token, owner, repo,
}: { token: string; owner: string; repo: string }): Promise<RepoDigest> {
  const gh = githubClient(token);

  const meta = await gh.repos.get({ owner, repo }); // throws → caller maps to friendly error
  const defaultBranch = meta.data.default_branch || "main";

  let tree: string[] = [];
  let treeTruncated = false;
  try {
    const t = await gh.git.getTree({ owner, repo, tree_sha: defaultBranch, recursive: "true" });
    treeTruncated = !!t.data.truncated;
    tree = (t.data.tree || [])
      .filter((n) => n.type === "blob" && typeof n.path === "string")
      .map((n) => n.path as string)
      .filter((p) => !SKIP_RE.test(p))
      .slice(0, MAX_TREE);
  } catch { /* empty/unreadable tree — digest still returns meta */ }

  const wanted = selectPaths(tree);
  const files: RepoFile[] = [];
  await Promise.all(
    wanted.map(async (path) => {
      try {
        const res = await gh.repos.getContent({ owner, repo, path });
        const d = res.data as { content?: string; encoding?: string; size?: number };
        if (!d?.content || (d.size ?? 0) > MAX_FILE_BYTES) return;
        const content = Buffer.from(d.content, (d.encoding as BufferEncoding) || "base64").toString("utf8");
        if (content.length > MAX_FILE_BYTES) return;
        files.push({ path, content });
      } catch { /* unreadable file — skip */ }
    }),
  );
  // Stable order (Promise.all resolves out of order).
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    fullName: meta.data.full_name,
    defaultBranch,
    description: meta.data.description ?? null,
    language: meta.data.language ?? null,
    topics: meta.data.topics ?? [],
    tree,
    files,
    treeTruncated,
    filesTruncated: wanted.length >= MAX_FILES,
  };
}
