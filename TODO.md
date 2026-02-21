# TODO

## Project Definition
- [ ] Finalize mobile Git system name (**GitLane**), vision, and guiding principles aligned with Problem Statement goals
- [ ] Document key success metrics (offline reliability, merge handling accuracy, repo integrity, **app performance via FS + AsyncStorage caching**)

## Repository Core **[P0 - Critical]**
- [x] Implement full offline Git backend (init, clone/import, commit, checkout, branch/tag creation, log, status) **using isomorphic-git**
- [x] Ensure repository storage remains compatible with desktop Git (objects, refs, config, hooks) **in File System**
- [x] Add atomic storage operations with crash recovery/**transaction logs stored in .git** to guard against corruption
- [ ] Provide repository health monitoring and auto-repair utilities (checksum/pack validation) **[Stretch]**

## Merge & Conflict Resolution **[P1 - High]**
- [ ] Build mobile-friendly merge workflow (compare branches, preview merges)
- [ ] Display diffs with touch-friendly UI, allow choosing/editing/combining conflict sections **(Cards: Ours vs. Theirs)**
- [ ] Auto-resolve trivial conflicts (whitespace/empty hunks) with user confirmation
- [ ] Add semantic conflict intelligence for structured merging (code-aware heuristics) **[Stretch/Brownie]**
- [ ] Keep merge previews editable and reversible before finalizing

## Branching, History, and Recovery **[P1/P3]**
- [ ] Support branching operations (create, switch, delete, rename, fetch history)
- [ ] Enable interactive rebase/commit rewrite (autosquash/fixup, reorder, drop/split) **[Stretch]**
- [ ] Provide stash management (create, apply, pop, drop, list with previews) **[Stretch]**
- [ ] Visualize commit graph with divergence heatmaps, timelines, contributor insights **[P3 - Use Cached Data]**
- [ ] Allow restore of deleted commits/branches via reflog-style history exploration
- [ ] Support advanced history search (semantic filters, natural language like "last release") **[P2 - AI Feature]**

## Mobile UX & Exploration **[P1 - High]**
- [x] Design touch-optimized staging workflow (file selection, hunks, staged vs unstaged)
- [ ] Present file diffs with syntax highlighting, inline edits, and code exploration links
- [ ] Enable fast file search (name/contents) and navigation via quick diff view
- [ ] Provide code reader mode with variable fonts/layout suitable for small screens
- [ ] Add contextual tooltips and help for advanced Git actions (rebases, resets)

- [x] Define the Git data hierarchy (blobs, trees, commits, refs) so it is managed entirely via the repository's File System (.git folder) with desktop compatibility.
- [x] Git-aligned file system caching (AsyncStorage for settings/identity, .git/gitlane_cache.json for commits/graph data).
- [x] Record transaction logs in .git (e.g., "Started Merge", "Started Commit") for crash-safe recovery before/after P0 workflows.
- [x] Implement commit log caching in .git to power instant UI loads and invalidate on new commits or merges.
- [ ] Optimize packfile handling and delta compression for large repos (>200MB) while profiling CPU and disk usage during long operations.
- [ ] Stress-test storage on constrained mobile devices to ensure stable operation even with extensive histories.

## Offline Transfer & Backup **[P2 - Brownie]**
- [ ] Implement peer-to-peer transfer (QR, Wi-Fi Direct, Bluetooth, local network share) **(QR + Local HTTP Server)**
- [ ] Verify transferred repos retain history and integrity, add checksum verification
- [ ] Offer optional backup paths (local storage, manual cloud sync) without breaking offline core

## AI Command Agent **[P2 - Online Only]**
- [ ] **Implement Natural Language Interface** (Convert text to Git commands via Cloud API)
- [ ] **Disable UI when Offline** (Show connectivity badge)
- [ ] **Fallback to Manual Mode** if API fails

## Additional Reliability & Quality
- [x] Native dependency cleanup (Expo Go-safe: AsyncStorage + File System)
- [x] Add crash-safe storage with transaction logs and recovery prompts on restart **(.git flags)**
- [ ] Provide repository health dashboard (warnings, corruption detection, repair suggestions)
- [ ] Build automated tests for offline workflows, merges, rebases, and transfers
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

---

## 📋 Priority Legend for Team
*   **[P0]**: Must have. App is useless without this. (Hours 0-6)
*   **[P1]**: High visibility. Essential for demo flow. (Hours 6-12)
*   **[P2]**: Brownie points. Implement only if P0/P1 stable. (Hours 12-15)
*   **[P3]**: Polish. Skip if time runs out. (Hours 15-18)
*   **[Stretch]**: Nice to have. Only touch if everything else is perfect.

Method,Effort,Implementation
Git Bundles (Easiest),Low,Use isomorphic-git to create a .bundle file. Use the phone's native Share Sheet (Bluetooth/AirDrop/WhatsApp).
QR Code (Small Repos),Medium,Convert a small patch or commit into a series of QR codes to be scanned by the other phone.
Local Socket (Hardest),High,"Use react-native-tcp-socket to create a mini-server on one phone that the other phone ""clones"" from over the same Wi-Fi."

Merge Conflict
P2P transfer
Notification
Offline Agent
Offline Code editor





API Keys SSH tokens