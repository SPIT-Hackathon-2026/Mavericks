# TODO

## Project Definition
- [x] Finalize mobile Git system name (**GitLane**), vision, and guiding principles aligned with Problem Statement goals
- [ ] Document key success metrics (offline reliability, merge handling accuracy, repo integrity, **app performance via FS + AsyncStorage caching**)

## Repository Core **[P0 - Critical]**
- [x] Implement full offline Git backend (init, clone/import, commit, checkout, branch creation, log, status) **using isomorphic-git**
- [x] Ensure repository storage remains compatible with desktop Git (objects, refs, config, hooks) **in File System**
- [x] Add atomic storage operations with crash recovery/**transaction logs stored in .git** to guard against corruption
- [x] Transaction types tracked: commit, merge, branch, clone, pull, push — all TX-wrapped with PENDING→COMPLETED/FAILED
- [x] Auto-expire stale PENDING transactions (>5 min) in `getPendingTransactions()`
- [ ] Tag creation (`git.tag` / `git.annotatedTag`) — not yet implemented
- [ ] Provide repository health monitoring and auto-repair utilities (checksum/pack validation) **[Stretch]** *(Settings button exists but shows static toast — no real health check logic)*

## Merge & Conflict Resolution **[P1 - High]**
- [x] Build mobile-friendly merge workflow (compare branches, preview merges) — `merge()`, `pull()` with merge, `push()` with auto-pull-merge
- [x] Display diffs with touch-friendly UI, allow choosing/editing/combining conflict sections **(Cards: Ours vs. Theirs)** — `merge-conflicts.tsx` with per-hunk Current/Incoming/Both/Manual Edit buttons
- [x] Three-way view (BASE / CURRENT / INCOMING tabs) for full file comparison
- [x] Manual inline editor for custom conflict resolution per hunk
- [x] Detect conflicts from `statusMatrix` stage-3 entries + conflict marker scanning in `handleMergeConflicts()`
- [x] Resolve ours/theirs/base content via `readBlob` from actual branch refs + `findMergeBase` for base
- [x] `finalizeMerge()` — force-checkout to clear unmerged index, write resolved content, stage, commit with dual parents, clean up MERGE_HEAD/MERGE_MSG
- [x] Auto-push after successful merge finalize (online → push immediately; offline → queue via pushQueue)
- [x] Handle `UnmergedPathsError` in push/pull/merge catch blocks — force-checkout cleanup + retry
- [x] `buildResolvedContent()` with safety validation (warns if conflict markers survive after resolution)
- [x] `RecoveryAlert` detects `MERGE_IN_PROGRESS` TXs with "Resume Merge Resolution →" button
- [x] `abortMerge()` — force-checkout + fail TX + cache delete
- [~] Auto-resolve trivial conflicts (whitespace/empty hunks) with user confirmation — *isomorphic-git's `abortOnConflict: false` auto-merges non-overlapping changes; no app-level whitespace/empty-hunk auto-resolution*
- [ ] Add semantic conflict intelligence for structured merging (code-aware heuristics) **[Stretch/Brownie]**
- [~] Keep merge previews editable and reversible before finalizing — *Undo button exists on resolved hunks in merge-conflicts.tsx; full abort available; but no partial revert of already-staged files*

## Branching, History, and Recovery **[P1/P3]**
- [x] Create branch (TX-wrapped `createBranch()` with UI in repository detail)
- [x] Switch branch (`switchBranch()` → `git.checkout()`)
- [ ] Delete branch (`git.deleteBranch`) — not implemented
- [ ] Rename branch — not implemented
- [x] Fetch history — `git.fetch()` in pull/push flows; branch metadata via `git.log()` per branch
- [x] Visualize commit graph — SVG-based graph in `graph/index.tsx` with nodes (circles for normal, rotated squares for merges), edges, HEAD glow ring, tappable commit rows
- [~] Commit graph stats — *branch tags always empty (`branches: []`), filesChanged/additions/deletions hardcoded to 0 in `getCommits()` — needs real data population*
- [ ] Enable interactive rebase/commit rewrite (autosquash/fixup, reorder, drop/split) **[Stretch]**
- [ ] Provide stash management (create, apply, pop, drop, list with previews) **[Stretch]**
- [ ] Allow restore of deleted commits/branches via reflog-style history exploration *(Settings toggle exists but no reflog implementation)*
- [ ] Support advanced history search (semantic filters, natural language like "last release") **[P2 - AI Feature]**

## Mobile UX & Exploration **[P1 - High]**
- [x] Design touch-optimized staging workflow (file selection, hunks, staged vs unstaged) — checkbox-style staging with haptic feedback in repository detail
- [x] File browser with nested directory tree, breadcrumb navigation, folder expansion, file icons by extension
- [x] File editor with view/edit toggle, save, revert, clipboard copy, commit from editor (`file-viewer.tsx`)
- [x] DiffViewer component — unified diffs with green/red line coloring, line numbers, hunk headers, change-type chips, collapsible file sections
- [~] Syntax highlighting — *basic regex-based token coloring (comments, imports, keywords, strings) in file-viewer — not a full syntax highlighter*
- [ ] Enable fast file search (name/contents) and navigation via quick diff view
- [ ] Provide code reader mode with variable fonts/layout suitable for small screens
- [ ] Add contextual tooltips and help for advanced Git actions (rebases, resets)

## Storage & Caching **[P0]**
- [x] Define the Git data hierarchy (blobs, trees, commits, refs) so it is managed entirely via the repository's File System (.git folder) with desktop compatibility
- [x] Git-aligned file system caching (AsyncStorage for settings/identity, .git/gitlane_cache.json for commits/graph data)
- [x] Record transaction logs in .git (e.g., "Started Merge", "Started Commit") for crash-safe recovery before/after P0 workflows
- [x] Implement commit log caching in .git to power instant UI loads and invalidate on new commits or merges
- [x] Cache invalidation — `deleteGitCache()` called after every commit, push, pull, merge, clone
- [x] Profile/contributions caching — full offline profile cache in `profileCache.ts` (profile, contributions, stats, activity, offline commits)
- [ ] Optimize packfile handling and delta compression for large repos (>200MB) while profiling CPU and disk usage during long operations
- [ ] Stress-test storage on constrained mobile devices to ensure stable operation even with extensive histories

## GitHub Integration **[P1]**
- [x] GitHub OAuth device flow — `startDeviceAuth()`, `openVerificationUrl()`, `pollDeviceToken()` in `api.ts`
- [x] List user repos with pagination — `listUserRepos()` in `api.ts`
- [x] Clone from GitHub — `cloneGitHubRepo()` with progress callbacks, token auth, depth-50 shallow clone
- [x] Push with token auth — `push()` in engine.ts, `pushSelectedRepo()` in GitContext
- [x] Pull with token auth — `pull()` in engine.ts, `pullSelectedRepo()` in GitContext
- [x] Commit diff via GitHub API — `fetchGitHubCommitFiles()` fetches per-commit file patches
- [x] Add/manage remotes — `addRemote()` in engine.ts
- [x] Remote URL parsing — `parseGitHubRemoteUrl()` in `api.ts`

## Offline Sync & Push Queue **[P1]**
- [x] `PushQueueManager` singleton — enqueue, drain, de-duplication, AsyncStorage persistence
- [x] Network monitoring every 8s — auto-drain queue on reconnect
- [x] Notification integration — `pushQueued`, `syncStarted`, `pushExecuted`, `pushFailed`, `syncComplete`
- [x] Push queue subscriber system for UI events (queued/syncing/success/failed/drain-start/drain-end)

## Offline Transfer & Backup **[P2 - Brownie]**
- [x] QR-code-based P2P transfer — sender selects repo+commits→generates QR, receiver scans→views diff→accepts (`p2pService.ts` — 605 lines)
- [x] Real diff in transfers — `buildRealDiffFiles()` uses GitHub API patches first, falls back to local Myers O(ND) diff algorithm
- [x] Transfer UI with send/receive tabs, session management — `transfer/index.tsx`
- [~] P2P transport — *currently AsyncStorage relay (same-device demo); code structured for real multi-device with WebSocket/TCP swap*
- [ ] Wi-Fi Direct / Bluetooth transport — not implemented (Settings has `p2pMethod` toggle but no real transport)
- [ ] Verify transferred repos retain history and integrity, add checksum verification
- [ ] Offer optional backup paths (local storage, manual cloud sync) without breaking offline core *(Settings "Export All" button exists but shows static toast — no real export)*

## Notifications **[P1]**
- [x] In-app `NotificationService` — sequential message queue, haptic feedback per type, auto-dismissal, subscription system
- [x] Push queue notification methods — `pushQueued()`, `syncStarted()`, `pushExecuted()`, `pushFailed()`, `syncComplete()`
- [x] `NotificationBanner` component + `Toast` component for UI feedback

## Profile & Settings **[P1]**
- [x] Full settings screen — Git Identity, GitHub auth, Notification toggles (5 categories), Appearance (theme, code font size), Storage (used/clear cache), P2P config, Advanced (reflog toggle, GC, health), About
- [x] GitHub profile screen — avatar, bio, location, contribution calendar heat grid, yearly stats, recent activity feed, online/offline badge, pull-to-refresh, offline commit tracking

## AI Command Agent **[P2 - Online Only]**
- [~] **Implement Natural Language Interface** — *UI stub exists in `chatbot.tsx` with chat bubbles + animated loading, but responses are random fakes from `FAKE_RESPONSES` array — no real AI backend*
- [ ] **Disable UI when Offline** (Show connectivity badge)
- [ ] **Fallback to Manual Mode** if API fails

## Additional Reliability & Quality
- [x] Native dependency cleanup (Expo Go-safe: AsyncStorage + File System)
- [x] Add crash-safe storage with transaction logs and recovery prompts on restart **(.git flags)** — `RecoveryAlert` component
- [x] Automated merge/conflict resolution tests — `merge-auto-resolve.test.ts` (691 lines, covers auto-resolve, conflict detection, parseConflictHunks, buildResolvedContent, integration)
- [ ] Provide repository health dashboard (warnings, corruption detection, repair suggestions)
- [ ] Build automated tests for offline workflows, rebases, and transfers
- [ ] Document usage guides/onboarding for mobile Git workflows

## Presentation & Demo Prep
- [ ] Prepare UI walkthrough showing merge, branch graph, staging, transfer features
- [ ] Record short demo of offline repo creation, merging with conflict resolution, and transfer
- [ ] Draft hackathon pitch highlighting how GitLane meets all Problem Statement requirements
- [ ] **Demo Script:** Start Offline (Core) → Turn Online (AI) → P2P Transfer

## Important 
- [x] **Seeding Data:** Have a zip file or a "Demo Repo" ready to import instantly. Judges hate waiting for a 100MB clone during a 3-minute pitch.
- [x] **Pre-Seed Conflict:** Ensure the demo repo has a guaranteed merge conflict ready to show off the resolution UI.
- [ ] **Airplane Mode:** Test the entire P0/P1 flow in Airplane Mode before the demo.

## Known Issues / Tech Debt
- [ ] Terminal screen is a placeholder — no actual command execution (`terminal.tsx`)
- [ ] Commit graph `getCommits()` returns hardcoded `branches: []`, `filesChanged: 0`, `additions: 0`, `deletions: 0` — needs real data
- [ ] `enableReflog` setting toggle exists but no actual reflog implementation in engine
- [ ] Chatbot is a stub — needs real AI backend or should be removed before demo
- [ ] P2P transfer uses AsyncStorage relay (same-device) — needs real networking for multi-device demo
- [ ] No checksum/integrity verification on P2P transfers
- [ ] "Export All" and "Repository Health" buttons in Settings are non-functional stubs
- [ ] File viewer syntax highlighting is regex-based line coloring, not a real tokenizer

---

## 📋 Priority Legend for Team
*   **[P0]**: Must have. App is useless without this. (Hours 0-6)
*   **[P1]**: High visibility. Essential for demo flow. (Hours 6-12)
*   **[P2]**: Brownie points. Implement only if P0/P1 stable. (Hours 12-15)
*   **[P3]**: Polish. Skip if time runs out. (Hours 15-18)
*   **[Stretch]**: Nice to have. Only touch if everything else is perfect.
*   **[~]**: Partially implemented — see inline notes

Method,Effort,Implementation
Git Bundles (Easiest),Low,Use isomorphic-git to create a .bundle file. Use the phone's native Share Sheet (Bluetooth/AirDrop/WhatsApp).
QR Code (Small Repos),Medium,Convert a small patch or commit into a series of QR codes to be scanned by the other phone.
Local Socket (Hardest),High,"Use react-native-tcp-socket to create a mini-server on one phone that the other phone ""clones"" from over the same Wi-Fi."