/**
 * Automated Merge Tests for GitLane
 *
 * These tests verify that isomorphic-git:
 *   1. Auto-resolves non-overlapping (auto-resolvable) changes cleanly
 *      → result.oid is truthy, no conflict UI needed.
 *   2. Produces conflict markers for overlapping changes
 *      → engine's parseConflictHunks can extract structured hunks.
 *   3. buildResolvedContent correctly rebuilds files from resolved hunks.
 *
 * The tests use Node.js `fs` as the isomorphic-git filesystem adapter
 * so they run in a standard Node/Jest environment without Expo dependencies.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import git from 'isomorphic-git';

// ---------------------------------------------------------------------------
// Helper: parseConflictHunks (extracted from engine.ts for testing)
// ---------------------------------------------------------------------------

interface ConflictHunk {
  id: string;
  oursContent: string;
  baseContent: string;
  theirsContent: string;
  resolved: boolean;
  resolution: 'ours' | 'theirs' | 'both' | 'manual' | null;
  resultContent: string;
}

function parseConflictHunks(rawContent: string): ConflictHunk[] {
  const hunks: ConflictHunk[] = [];
  const lines = rawContent.split('\n');
  let i = 0;
  let hunkIndex = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const oursLines: string[] = [];
      const baseLines: string[] = [];
      const theirsLines: string[] = [];
      let phase: 'ours' | 'base' | 'theirs' = 'ours';
      i++;

      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        if (lines[i].startsWith('|||||||')) { phase = 'base'; i++; continue; }
        if (lines[i].startsWith('=======')) { phase = 'theirs'; i++; continue; }
        if (phase === 'ours') oursLines.push(lines[i]);
        else if (phase === 'base') baseLines.push(lines[i]);
        else theirsLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;

      hunks.push({
        id: `hunk-${hunkIndex++}`,
        oursContent: oursLines.join('\n'),
        baseContent: baseLines.join('\n'),
        theirsContent: theirsLines.join('\n'),
        resolved: false,
        resolution: null,
        resultContent: '',
      });
    } else {
      i++;
    }
  }
  return hunks;
}

// ---------------------------------------------------------------------------
// Helper: buildResolvedContent (extracted from engine.ts for testing)
// ---------------------------------------------------------------------------

function buildResolvedContent(rawContent: string, hunks: ConflictHunk[]): string {
  const lines = rawContent.split('\n');
  const result: string[] = [];
  let lineIdx = 0;
  let hunkIdx = 0;

  while (lineIdx < lines.length) {
    if (lines[lineIdx].startsWith('<<<<<<<') && hunkIdx < hunks.length) {
      const hunk = hunks[hunkIdx++];
      while (lineIdx < lines.length && !lines[lineIdx].startsWith('>>>>>>>')) {
        lineIdx++;
      }
      if (lineIdx < lines.length) lineIdx++;
      result.push(hunk.resultContent);
    } else {
      result.push(lines[lineIdx]);
      lineIdx++;
    }
  }
  return result.join('\n');
}

// ---------------------------------------------------------------------------
// Test setup helpers
// ---------------------------------------------------------------------------

const author = { name: 'Test User', email: 'test@gitlane.dev' };

async function createTempRepo(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlane-test-'));
  await git.init({ fs, dir, defaultBranch: 'main' });
  return dir;
}

function cleanupRepo(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function writeAndCommit(
  dir: string,
  files: Record<string, string>,
  message: string,
): Promise<string> {
  for (const [filepath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filepath);
    const dirName = path.dirname(fullPath);
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    await git.add({ fs, dir, filepath });
  }
  const oid = await git.commit({ fs, dir, message, author });
  return oid;
}

// ---------------------------------------------------------------------------
// TEST SUITE 1: Auto-resolvable (non-overlapping) merges
// ---------------------------------------------------------------------------

describe('Auto-resolvable merges (non-overlapping changes)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(dir);
  });

  test('changes to different files merge cleanly', async () => {
    // Base commit: two files
    await writeAndCommit(dir, {
      'fileA.txt': 'Hello from file A\n',
      'fileB.txt': 'Hello from file B\n',
    }, 'initial commit');

    // Create feature branch from main
    await git.branch({ fs, dir, ref: 'feature' });

    // Commit on main: modify fileA only
    await writeAndCommit(dir, {
      'fileA.txt': 'Hello from file A (updated on main)\n',
    }, 'update fileA on main');

    // Switch to feature branch and modify fileB only
    await git.checkout({ fs, dir, ref: 'feature' });
    await writeAndCommit(dir, {
      'fileB.txt': 'Hello from file B (updated on feature)\n',
    }, 'update fileB on feature');

    // Switch back to main and merge
    await git.checkout({ fs, dir, ref: 'main' });
    const result = await git.merge({
      fs,
      dir,
      ours: 'main',
      theirs: 'feature',
      author,
      abortOnConflict: false,
    });

    // Merge should succeed cleanly
    expect(result.oid).toBeTruthy();
    expect(result.alreadyMerged).toBeFalsy();

    // Force checkout to update working directory from the merge commit tree
    await git.checkout({ fs, dir, ref: 'main', force: true });
    const fileA = fs.readFileSync(path.join(dir, 'fileA.txt'), 'utf8');
    const fileB = fs.readFileSync(path.join(dir, 'fileB.txt'), 'utf8');

    expect(fileA).toBe('Hello from file A (updated on main)\n');
    expect(fileB).toBe('Hello from file B (updated on feature)\n');
  });

  test('non-overlapping changes in the SAME file merge cleanly', async () => {
    // Base: file with well-separated sections (enough context for 3-way merge)
    const baseContent = [
      '// ============ Module Header ============',
      '// Application constants',
      '',
      '// --- Section A ---',
      'const a = 1;',
      'const a2 = "unchanged";',
      '',
      '// --- Separator 1 ---',
      '// This block is never modified by either branch',
      '// It provides context for the merge algorithm',
      'const separator1 = true;',
      '',
      '// --- Section B ---',
      'const b = 2;',
      'const b2 = "also unchanged";',
      '',
      '// --- Separator 2 ---',
      '// Another context block',
      'const separator2 = true;',
      '',
      '// --- Section C ---',
      'const c = 3;',
      'const c2 = "stays the same";',
      '',
      '// ============ Module Footer ============',
    ].join('\n');

    await writeAndCommit(dir, { 'code.ts': baseContent }, 'initial');
    await git.branch({ fs, dir, ref: 'feature' });

    // Main: modify only Section A
    const mainContent = baseContent.replace('const a = 1;', 'const a = 100;');
    await writeAndCommit(dir, { 'code.ts': mainContent }, 'update section A on main');

    // Feature: modify only Section C
    await git.checkout({ fs, dir, ref: 'feature' });
    const featureContent = baseContent.replace('const c = 3;', 'const c = 300;');
    await writeAndCommit(dir, { 'code.ts': featureContent }, 'update section C on feature');

    // Merge
    await git.checkout({ fs, dir, ref: 'main' });
    const result = await git.merge({
      fs,
      dir,
      ours: 'main',
      theirs: 'feature',
      author,
      abortOnConflict: false,
    });

    expect(result.oid).toBeTruthy();

    // Force checkout to update working directory from the merge commit tree
    // (git.checkout on the same branch may skip updating working files)
    await git.checkout({ fs, dir, ref: 'main', force: true });
    const merged = fs.readFileSync(path.join(dir, 'code.ts'), 'utf8');
    expect(merged).toContain('const a = 100;');
    expect(merged).toContain('const c = 300;');
    // Section B should be unchanged
    expect(merged).toContain('const b = 2;');
    // No conflict markers should be present
    expect(merged).not.toContain('<<<<<<<');
  });

  test('adding new files on different branches merges cleanly', async () => {
    await writeAndCommit(dir, { 'base.txt': 'base\n' }, 'initial');
    await git.branch({ fs, dir, ref: 'feature' });

    // Main adds a new file
    await writeAndCommit(dir, { 'new-on-main.txt': 'added on main\n' }, 'add file on main');

    // Feature adds a different new file
    await git.checkout({ fs, dir, ref: 'feature' });
    await writeAndCommit(dir, { 'new-on-feature.txt': 'added on feature\n' }, 'add file on feature');

    // Merge
    await git.checkout({ fs, dir, ref: 'main' });
    const result = await git.merge({
      fs,
      dir,
      ours: 'main',
      theirs: 'feature',
      author,
      abortOnConflict: false,
    });

    expect(result.oid).toBeTruthy();

    await git.checkout({ fs, dir, ref: 'main', force: true });
    expect(fs.existsSync(path.join(dir, 'new-on-main.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'new-on-feature.txt'))).toBe(true);
  });

  test('fast-forward merge when main has no new commits', async () => {
    await writeAndCommit(dir, { 'file.txt': 'v1\n' }, 'initial');
    await git.branch({ fs, dir, ref: 'feature' });

    // Only feature has commits
    await git.checkout({ fs, dir, ref: 'feature' });
    await writeAndCommit(dir, { 'file.txt': 'v2 from feature\n' }, 'update on feature');

    // Merge into main (should fast-forward)
    await git.checkout({ fs, dir, ref: 'main' });
    const result = await git.merge({
      fs,
      dir,
      ours: 'main',
      theirs: 'feature',
      author,
      abortOnConflict: false,
    });

    expect(result.oid).toBeTruthy();
  });

  test('already merged returns alreadyMerged flag', async () => {
    await writeAndCommit(dir, { 'file.txt': 'base\n' }, 'initial');
    await git.branch({ fs, dir, ref: 'feature' });

    // Merge feature into main (already at same commit)
    const result = await git.merge({
      fs,
      dir,
      ours: 'main',
      theirs: 'feature',
      author,
      abortOnConflict: false,
    });

    expect(result.alreadyMerged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE 2: Conflicting (overlapping) merges
// ---------------------------------------------------------------------------

describe('Conflicting merges (overlapping changes)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(dir);
  });

  test('overlapping changes to same line produce MergeConflictError', async () => {
    await writeAndCommit(dir, {
      'file.txt': 'line 1\nline 2\nline 3\n',
    }, 'initial');

    await git.branch({ fs, dir, ref: 'feature' });

    // Main changes line 2
    await writeAndCommit(dir, {
      'file.txt': 'line 1\nline 2 modified by main\nline 3\n',
    }, 'modify line 2 on main');

    // Feature changes same line 2
    await git.checkout({ fs, dir, ref: 'feature' });
    await writeAndCommit(dir, {
      'file.txt': 'line 1\nline 2 modified by feature\nline 3\n',
    }, 'modify line 2 on feature');

    // Merge — isomorphic-git throws MergeConflictError for true conflicts
    // This is exactly what our engine catches in the try/catch block
    await git.checkout({ fs, dir, ref: 'main' });
    let caughtError: any = null;
    try {
      await git.merge({
        fs,
        dir,
        ours: 'main',
        theirs: 'feature',
        author,
        abortOnConflict: false,
      });
    } catch (err: any) {
      caughtError = err;
    }

    // isomorphic-git should throw a MergeConflictError
    // Our engine.ts catches this and calls handleMergeConflicts()
    expect(caughtError).not.toBeNull();
    expect(
      caughtError?.code === 'MergeConflictError' ||
      caughtError?.code === 'MergeNotSupportedError' ||
      (caughtError?.message && caughtError.message.includes('onflict'))
    ).toBe(true);
  });

  test('parseConflictHunks extracts hunks from conflict markers', () => {
    const conflictContent = [
      'line 1',
      '<<<<<<< ours',
      'our change',
      '=======',
      'their change',
      '>>>>>>> theirs',
      'line 3',
    ].join('\n');

    const hunks = parseConflictHunks(conflictContent);

    expect(hunks).toHaveLength(1);
    expect(hunks[0].oursContent).toBe('our change');
    expect(hunks[0].theirsContent).toBe('their change');
    expect(hunks[0].baseContent).toBe(''); // no ||||||| marker
    expect(hunks[0].resolved).toBe(false);
    expect(hunks[0].resolution).toBeNull();
    expect(hunks[0].id).toBe('hunk-0');
  });

  test('parseConflictHunks handles multiple hunks', () => {
    const content = [
      'header',
      '<<<<<<< ours',
      'ours hunk 1',
      '=======',
      'theirs hunk 1',
      '>>>>>>> theirs',
      'middle',
      '<<<<<<< ours',
      'ours hunk 2',
      '=======',
      'theirs hunk 2',
      '>>>>>>> theirs',
      'footer',
    ].join('\n');

    const hunks = parseConflictHunks(content);

    expect(hunks).toHaveLength(2);
    expect(hunks[0].id).toBe('hunk-0');
    expect(hunks[0].oursContent).toBe('ours hunk 1');
    expect(hunks[0].theirsContent).toBe('theirs hunk 1');
    expect(hunks[1].id).toBe('hunk-1');
    expect(hunks[1].oursContent).toBe('ours hunk 2');
    expect(hunks[1].theirsContent).toBe('theirs hunk 2');
  });

  test('parseConflictHunks handles diff3 (three-way) markers', () => {
    const content = [
      '<<<<<<< ours',
      'ours version',
      '||||||| base',
      'base version',
      '=======',
      'theirs version',
      '>>>>>>> theirs',
    ].join('\n');

    const hunks = parseConflictHunks(content);

    expect(hunks).toHaveLength(1);
    expect(hunks[0].oursContent).toBe('ours version');
    expect(hunks[0].baseContent).toBe('base version');
    expect(hunks[0].theirsContent).toBe('theirs version');
  });

  test('parseConflictHunks handles multi-line content in hunks', () => {
    const content = [
      'before',
      '<<<<<<< ours',
      'ours line 1',
      'ours line 2',
      'ours line 3',
      '=======',
      'theirs line 1',
      'theirs line 2',
      '>>>>>>> theirs',
      'after',
    ].join('\n');

    const hunks = parseConflictHunks(content);

    expect(hunks).toHaveLength(1);
    expect(hunks[0].oursContent).toBe('ours line 1\nours line 2\nours line 3');
    expect(hunks[0].theirsContent).toBe('theirs line 1\ntheirs line 2');
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE 3: buildResolvedContent
// ---------------------------------------------------------------------------

describe('buildResolvedContent', () => {
  test('replaces single conflict hunk with resolved content', () => {
    const raw = [
      'line 1',
      '<<<<<<< ours',
      'our text',
      '=======',
      'their text',
      '>>>>>>> theirs',
      'line 3',
    ].join('\n');

    const hunks: ConflictHunk[] = [{
      id: 'hunk-0',
      oursContent: 'our text',
      baseContent: '',
      theirsContent: 'their text',
      resolved: true,
      resolution: 'ours',
      resultContent: 'our text',
    }];

    const result = buildResolvedContent(raw, hunks);
    expect(result).toBe('line 1\nour text\nline 3');
  });

  test('replaces multiple conflict hunks', () => {
    const raw = [
      'header',
      '<<<<<<< ours',
      'A ours',
      '=======',
      'A theirs',
      '>>>>>>> theirs',
      'middle',
      '<<<<<<< ours',
      'B ours',
      '=======',
      'B theirs',
      '>>>>>>> theirs',
      'footer',
    ].join('\n');

    const hunks: ConflictHunk[] = [
      {
        id: 'hunk-0',
        oursContent: 'A ours',
        baseContent: '',
        theirsContent: 'A theirs',
        resolved: true,
        resolution: 'theirs',
        resultContent: 'A theirs',
      },
      {
        id: 'hunk-1',
        oursContent: 'B ours',
        baseContent: '',
        theirsContent: 'B theirs',
        resolved: true,
        resolution: 'both',
        resultContent: 'B ours\nB theirs',
      },
    ];

    const result = buildResolvedContent(raw, hunks);
    expect(result).toBe('header\nA theirs\nmiddle\nB ours\nB theirs\nfooter');
  });

  test('preserves non-conflict content unchanged', () => {
    const raw = 'line 1\nline 2\nline 3';
    const result = buildResolvedContent(raw, []);
    expect(result).toBe('line 1\nline 2\nline 3');
  });

  test('handles manual edit resolution', () => {
    const raw = [
      'before',
      '<<<<<<< ours',
      'old code',
      '=======',
      'new code',
      '>>>>>>> theirs',
      'after',
    ].join('\n');

    const hunks: ConflictHunk[] = [{
      id: 'hunk-0',
      oursContent: 'old code',
      baseContent: '',
      theirsContent: 'new code',
      resolved: true,
      resolution: 'manual',
      resultContent: 'completely custom code\nwith multiple lines',
    }];

    const result = buildResolvedContent(raw, hunks);
    expect(result).toBe('before\ncompletely custom code\nwith multiple lines\nafter');
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE 4: Integration — merge result drives UI decision
// ---------------------------------------------------------------------------

describe('Merge result determines UI flow', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(dir);
  });

  test('clean merge does NOT trigger conflict UI (returns clean: true equivalent)', async () => {
    await writeAndCommit(dir, {
      'fileA.txt': 'A base\n',
      'fileB.txt': 'B base\n',
    }, 'initial');

    await git.branch({ fs, dir, ref: 'feature' });

    // Non-overlapping changes
    await writeAndCommit(dir, { 'fileA.txt': 'A updated\n' }, 'main change');
    await git.checkout({ fs, dir, ref: 'feature' });
    await writeAndCommit(dir, { 'fileB.txt': 'B updated\n' }, 'feature change');
    await git.checkout({ fs, dir, ref: 'main' });

    const result = await git.merge({
      fs,
      dir,
      ours: 'main',
      theirs: 'feature',
      author,
      abortOnConflict: false,
    });

    // Simulate engine's logic: check for conflict markers
    const needsUI = await checkForConflictMarkers(dir);

    expect(result.oid).toBeTruthy();
    expect(needsUI).toBe(false);
    // → In the app, this is `{ clean: true }` and no navigation to merge-conflicts
  });

  test('conflicting merge DOES trigger conflict UI (throws MergeConflictError)', async () => {
    await writeAndCommit(dir, {
      'file.txt': 'original content\n',
    }, 'initial');

    await git.branch({ fs, dir, ref: 'feature' });

    await writeAndCommit(dir, { 'file.txt': 'main version\n' }, 'main edit');
    await git.checkout({ fs, dir, ref: 'feature' });
    await writeAndCommit(dir, { 'file.txt': 'feature version\n' }, 'feature edit');
    await git.checkout({ fs, dir, ref: 'main' });

    let caughtError: any = null;
    try {
      await git.merge({
        fs,
        dir,
        ours: 'main',
        theirs: 'feature',
        author,
        abortOnConflict: false,
      });
    } catch (err: any) {
      caughtError = err;
    }

    // The error IS the signal that triggers the conflict UI
    // Engine.ts catches this exact pattern and enters conflict resolution mode:
    //   if (err?.code === 'MergeConflictError' || ...) → handleMergeConflicts()
    expect(caughtError).not.toBeNull();
    expect(
      caughtError?.code === 'MergeConflictError' ||
      caughtError?.code === 'MergeNotSupportedError' ||
      caughtError?.message?.includes('onflict')
    ).toBe(true);
    // → In the app this triggers `{ clean: false, mergeState }` and navigates to /merge-conflicts
  });
});

// ---------------------------------------------------------------------------
// Helper: simulates what engine.ts handleMergeConflicts does
// ---------------------------------------------------------------------------

async function checkForConflictMarkers(dir: string): Promise<boolean> {
  const statusMatrix = await git.statusMatrix({ fs, dir });

  for (const [filepath, , workdir] of statusMatrix) {
    if (filepath.startsWith('.git/') || filepath === '.git') continue;
    if (workdir === 2 || workdir === 0) {
      const fullPath = path.join(dir, filepath);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('<<<<<<<') && content.includes('>>>>>>>')) {
          return true;
        }
      } catch { /* skip */ }
    }
  }
  return false;
}
