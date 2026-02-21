/**
 * ChatbotService – natural language → git action → human response
 *
 * Architecture:
 *  1. User query  → regex/keyword intent detector (instant, 100% reliable)
 *  2. Parsed intent → executeGitIntent() → structured result
 *  3. Result JSON → llama.cpp (humanize) → final readable text
 *  4. Casual / greeting / unknown → llama.cpp for conversational reply
 *
 * llama.cpp server must be running on the device via Termux:
 *   ~/llama.cpp/build/bin/llama-server \
 *     -m ~/llama.cpp/models/Qwen2.5-7B-Instruct.Q5_K_M.gguf \
 *     --host 0.0.0.0 --port 8080
 */

import git from 'isomorphic-git';
import { gitEngine } from './engine';
import { expoFS } from './expo-fs';

// ── Config ────────────────────────────────────────────────────────────────────

/** llama.cpp OpenAI-compatible endpoint */
const LLAMA_URL = 'http://127.0.0.1:8080/v1/chat/completions';

// ── Low-level LLM call ────────────────────────────────────────────────────────

type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string };

interface LLMOptions {
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send a chat request to the local llama.cpp server.
 * Retries up to 5x on HTTP 503 (model still loading).
 */
async function callLLM(opts: LLMOptions): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'system', content: opts.systemPrompt },
    { role: 'user',   content: opts.userMessage   },
  ];

  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(LLAMA_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages,
          stream:      false,
          temperature: 0.7,
          max_tokens:  opts.maxTokens,
          stop:        ['<|im_end|>', '<|endoftext|>'],
        }),
      });

      if (res.status === 503) {
        await sleep(RETRY_DELAY);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '(no body)');
        throw new Error(`llama-server HTTP ${res.status}: ${text}`);
      }

      type Choice = { message?: { content?: string }; finish_reason?: string };
      const data = await res.json() as {
        choices?: Choice[];
        error?: { message?: string };
      };

      if (data.error?.message) {
        throw new Error(`llama-server error: ${data.error.message}`);
      }

      const choice  = data.choices?.[0];
      const content = choice?.message?.content?.trim() ?? '';

      if (!content) {
        const reason = choice?.finish_reason ?? 'unknown';
        throw new Error(
          `llama-server returned empty response (finish_reason: ${reason}).`,
        );
      }

      if (choice?.finish_reason === 'length') {
        console.warn('[chatbot] LLM response truncated (hit max_tokens)');
      }

      return content;
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e?.message?.startsWith('llama-server')) throw err;
      throw new Error(`Cannot reach llama-server: ${e?.message ?? String(err)}`);
    }
  }

  throw new Error(
    `llama-server is still loading after ${MAX_RETRIES} attempts. ` +
    'Wait a few seconds then try again.',
  );
}

// ── Intent types ──────────────────────────────────────────────────────────────

type Intent =
  | { type: 'GET_RECENT_CHANGES' }
  | { type: 'GET_COMMITS_BY_DATE'; from: string; to: string }
  | { type: 'SEARCH_FILES'; keyword: string }
  | { type: 'GET_COMMITS_BY_AUTHOR'; author: string }
  | { type: 'CASUAL_CHAT' };

// ── Regex / keyword intent detection (no LLM — instant, 100% reliable) ────────

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Classify the user message into a typed Intent using keyword and regex
 * matching. No LLM call needed here — this runs instantly and never fails.
 *
 * Priority: author → absolute date → relative date → file search → recent changes → casual
 */
export function detectIntent(input: string): Intent {
  const q = input.toLowerCase().trim();

  // ── 1. Author ──────────────────────────────────────────────────────────────
  // "commits by X", "find commits by X", "show commits from X",
  // "changes by X", "X's commits", "author: X"
  const NOISE = new Set(['the', 'a', 'an', 'me', 'my', 'us', 'our', 'your', 'him', 'her']);
  const authorPatterns: RegExp[] = [
    /commits?\s+by\s+([a-z][\w ]{1,40}?)(?:\s*$|[,.])/i,
    /find\s+(?:commits?\s+(?:by|from)|author)\s+([a-z][\w ]{1,40}?)(?:\s*$|[,.])/i,
    /show\s+(?:me\s+)?commits?\s+(?:from|by)\s+([a-z][\w ]{1,40}?)(?:\s*$|[,.])/i,
    /(?:changes|work)\s+(?:by|from)\s+([a-z][\w ]{1,40}?)(?:\s*$|[,.])/i,
    /([a-z][\w]{1,30})'s\s+commits?/i,
    /author[:\s]+([a-z][\w ]{1,40}?)(?:\s*$|[,.])/i,
    /committed\s+by\s+([a-z][\w ]{1,40}?)(?:\s*$|[,.])/i,
  ];
  for (const pat of authorPatterns) {
    const m = input.match(pat);
    if (m?.[1]) {
      const author = m[1].trim();
      if (!NOISE.has(author.toLowerCase()) && author.length >= 2) {
        return { type: 'GET_COMMITS_BY_AUTHOR', author };
      }
    }
  }

  // ── 2. Absolute date range ─────────────────────────────────────────────────
  // "from 2024-01-01 to 2024-02-01" or "between 2024-01-01 and 2024-02-01"
  const absDate =
    input.match(/from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i) ||
    input.match(/between\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})/i);
  if (absDate) {
    return { type: 'GET_COMMITS_BY_DATE', from: absDate[1], to: absDate[2] };
  }

  // ── 3. Relative date range ─────────────────────────────────────────────────
  const today = new Date();

  if (/last\s+week|past\s+week|this\s+week/i.test(q)) {
    const from = new Date(today); from.setDate(from.getDate() - 7);
    return { type: 'GET_COMMITS_BY_DATE', from: fmtDate(from), to: fmtDate(today) };
  }
  if (/last\s+month|past\s+month|this\s+month/i.test(q)) {
    const from = new Date(today); from.setDate(from.getDate() - 30);
    return { type: 'GET_COMMITS_BY_DATE', from: fmtDate(from), to: fmtDate(today) };
  }
  if (/\byesterday\b/i.test(q)) {
    const from = new Date(today); from.setDate(from.getDate() - 1);
    return { type: 'GET_COMMITS_BY_DATE', from: fmtDate(from), to: fmtDate(today) };
  }
  if (/\btoday\b/i.test(q)) {
    return { type: 'GET_COMMITS_BY_DATE', from: fmtDate(today), to: fmtDate(today) };
  }
  const daysMatch = q.match(/(?:last|past)\s+(\d+)\s+days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const from = new Date(today); from.setDate(from.getDate() - days);
    return { type: 'GET_COMMITS_BY_DATE', from: fmtDate(from), to: fmtDate(today) };
  }

  // ── 4. File search ─────────────────────────────────────────────────────────
  // "search for files named X", "find file X", "search files for X", etc.
  const filePatterns: RegExp[] = [
    /(?:search|find|look)\s+(?:for\s+)?files?\s+(?:named|called|with|matching)\s+["']?(.+?)["']?(?:\s*$|[,.])/i,
    /(?:search|find|look)\s+for\s+["']?(.+?)["']?\s+files?/i,
    /files?\s+(?:named|called|containing|with)\s+["']?(.+?)["']?(?:\s*$|[,.])/i,
    /search\s+(?:files?\s+)?for\s+["']?(.+?)["']?(?:\s*$|[,.])/i,
    /find\s+["']?(.+?)["']?\s+files?/i,
  ];
  for (const pat of filePatterns) {
    const m = input.match(pat);
    if (m?.[1]?.trim() && m[1].trim().length >= 2) {
      return { type: 'SEARCH_FILES', keyword: m[1].trim() };
    }
  }

  // ── 5. Recent / general commit history ────────────────────────────────────
  // Broad set of natural phrases users might say
  const recentPhrases = [
    'latest changes', 'recent changes', 'latest commits', 'recent commits',
    'last commits',   'last changes',   'show changes',   'show commits',
    'what changed',   'what happened',  'commit history', 'git log',
    'show history',   'show me',        'show the',       'see commits',
    'latest',         'changes',        'commits',        'history',
    'last release',   'changelog',      "what's new",     'whats new',
    'any updates',    'recent updates', 'new commits',    'list commits',
    'all commits',    'view commits',
  ];
  if (recentPhrases.some(phrase => q.includes(phrase))) {
    return { type: 'GET_RECENT_CHANGES' };
  }

  // ── 6. Default: casual conversation ───────────────────────────────────────
  return { type: 'CASUAL_CHAT' };
}

// ── LLM prompts ───────────────────────────────────────────────────────────────

const HUMANIZE_SYSTEM =
  'You are a friendly Git assistant. Convert the following git data into a ' +
  'clear, concise conversational message. Plain English only — no JSON, no ' +
  'markdown code blocks, no bullet point overload. Be warm and direct.';

const buildHumanizeMsg = (result: unknown) =>
  `Summarize this git data in a friendly way:\n${JSON.stringify(result, null, 2)}`;

const CASUAL_SYSTEM =
  'You are a friendly, helpful Git assistant embedded in a mobile Git client. ' +
  'Chat naturally. Keep replies short and warm. ' +
  'If asked about yourself, say you help developers understand their git repos. ' +
  'Do not output JSON.';

// ── Git endpoint execution ────────────────────────────────────────────────────

async function executeGitIntent(intent: Intent, repoId: string): Promise<unknown> {
  const fs  = expoFS;
  const dir = gitEngine.resolveRepoDir(repoId);

  switch (intent.type) {

    case 'GET_RECENT_CHANGES': {
      const commits = await gitEngine.getCommits(repoId);
      const recent  = commits.slice(0, 10);
      return {
        summary: `${recent.length} most recent commit(s)`,
        commits: recent.map(c => ({
          sha:     c.shortSha,
          message: c.message.trim(),
          author:  c.author,
          date:    c.date,
        })),
      };
    }

    case 'GET_COMMITS_BY_DATE': {
      const { from, to } = intent;
      const fromMs = new Date(from).getTime();
      const toMs   = new Date(to).getTime() + 86_400_000; // inclusive

      await gitEngine.init();
      const rawLog = await git.log({ fs, dir, depth: 200 });

      const filtered = rawLog.filter(entry => {
        const ts = (entry.commit.author.timestamp ?? 0) * 1000;
        return ts >= fromMs && ts <= toMs;
      });

      return {
        summary:   `${filtered.length} commit(s) between ${from} and ${to}`,
        dateRange: { from, to },
        commits:   filtered.map(entry => ({
          sha:     entry.oid.slice(0, 7),
          message: entry.commit.message.trim(),
          author:  entry.commit.author.name,
          date:    new Date((entry.commit.author.timestamp ?? 0) * 1000)
                     .toISOString().slice(0, 10),
        })),
      };
    }

    case 'SEARCH_FILES': {
      const kw   = intent.keyword.toLowerCase();
      const tree = await gitEngine.getWorkingTree(repoId);

      const flatten = (nodes: typeof tree): typeof tree => {
        const out: typeof tree = [];
        for (const node of nodes) {
          if (node.isDirectory && node.children) out.push(...flatten(node.children));
          else out.push(node);
        }
        return out;
      };

      const matched = flatten(tree).filter(
        f => f.name.toLowerCase().includes(kw) || f.path.toLowerCase().includes(kw),
      );

      return {
        summary: `${matched.length} file(s) matching "${intent.keyword}"`,
        keyword: intent.keyword,
        files:   matched.map(f => ({
          name:   f.name,
          path:   f.path,
          status: f.status ?? 'tracked',
          size:   f.size ? `${(f.size / 1024).toFixed(1)} KB` : undefined,
        })),
      };
    }

    case 'GET_COMMITS_BY_AUTHOR': {
      const authorLc = intent.author.toLowerCase();
      const commits  = await gitEngine.getCommits(repoId);
      const matched  = commits.filter(
        c => c.author.toLowerCase().includes(authorLc),
      );

      return {
        summary: `${matched.length} commit(s) by "${intent.author}"`,
        author:  intent.author,
        commits: matched.map(c => ({
          sha:     c.shortSha,
          message: c.message.trim(),
          date:    c.date,
        })),
      };
    }

    default:
      throw new Error('executeGitIntent called with non-git intent');
  }
}

// ── Fallback formatter (shown when LLM is offline) ────────────────────────────

function formatFallback(result: unknown): string {
  if (typeof result !== 'object' || result === null) return String(result);

  const r = result as Record<string, unknown>;
  const lines: string[] = [];

  if (r.summary) lines.push(String(r.summary));

  if (Array.isArray(r.commits)) {
    for (const c of r.commits as Record<string, string>[]) {
      const who  = c.author ? ` — ${c.author}` : '';
      const when = c.date   ? ` (${c.date})`   : '';
      lines.push(`• [${c.sha}] ${c.message}${who}${when}`);
    }
  }

  if (Array.isArray(r.files)) {
    for (const f of r.files as Record<string, string>[]) {
      lines.push(`• ${f.path} (${f.status}${f.size ? `, ${f.size}` : ''})`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : JSON.stringify(result, null, 2);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Main chatbot entry point.
 *
 *  1. detectIntent()   — regex/keyword routing (instant, no LLM)
 *  2a. Git intents     → executeGitIntent() → LLM humanize (or formatFallback)
 *  2b. CASUAL_CHAT     → LLM conversational reply
 *
 * @param userInput  Raw message typed by the user
 * @param repoId     Active repository ID (may be null if none selected)
 */
export async function handleUserMessage(
  userInput: string,
  repoId: string | null,
): Promise<string> {

  const intent = detectIntent(userInput);

  // ── Casual chat works without any repo ───────────────────────────────────
  if (intent.type === 'CASUAL_CHAT') {
    try {
      return await callLLM({
        systemPrompt: CASUAL_SYSTEM,
        userMessage:  userInput,
        maxTokens:    200,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Couldn't reach the AI assistant: ${msg}\n\nMake sure llama-server is running in Termux.`;
    }
  }

  // ── Git intents require an active repo ───────────────────────────────────
  if (!repoId) {
    return (
      'No repository is selected. Please open or select a repository first, ' +
      'then I can answer questions about its commits, files, and history.'
    );
  }

  // ── Execute git action ────────────────────────────────────────────────────
  let result: unknown;
  try {
    result = await executeGitIntent(intent, repoId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `❌ ${msg}`;
  }

  // ── Humanize result with LLM (graceful fallback to plain text) ────────────
  try {
    const humanized = await callLLM({
      systemPrompt: HUMANIZE_SYSTEM,
      userMessage:  buildHumanizeMsg(result),
      maxTokens:    300,
    });
    return humanized || formatFallback(result);
  } catch {
    // LLM offline or failed — the formatted data is still useful
    return formatFallback(result);
  }
}
