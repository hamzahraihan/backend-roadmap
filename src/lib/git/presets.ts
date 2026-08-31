import type { GitPreset, GitState, Commit } from './types';

function emptyState(): GitState {
  return {
    initialized: false,
    commits: new Map(),
    branches: new Map(),
    head: null,
    detachedCommit: null,
    index: new Set(),
    workingDir: new Map(),
    remotes: new Map(),
    stash: [],
    conflict: null,
    config: new Map([['user.name', 'You'], ['user.email', 'you@example.com']]),
    commitCounter: 0,
    remoteCommitsAhead: new Map(),
    commitFileSnapshots: new Map(),
    tags: new Map(),
  };
}

function genId(counter: number): { id: string; shortId: string } {
  const hex = (counter + 0xabc123).toString(16).padStart(7, '0').slice(-7);
  const id = (hex + hex + hex + hex + hex + hex).slice(0, 40);
  return { id, shortId: hex };
}

function addCommit(state: GitState, message: string, files: Record<string, string>, branch = 'main'): string {
  const counter = state.commitCounter + 1;
  state.commitCounter = counter;
  const { id, shortId } = genId(counter);
  const parent = state.branches.get(branch)?.target ?? null;
  const parents = parent ? [parent] : [];
  const commit: Commit = {
    id,
    shortId,
    message,
    parents,
    author: 'You <you@example.com>',
    timestamp: Date.now() + counter * 1000,
    branchAtCreation: branch,
  };
  state.commits.set(id, commit);
  const snap = new Map<string, string>();
  // include previous snapshot files + new files
  const prevSnap = parent ? state.commitFileSnapshots.get(parent) : undefined;
  if (prevSnap) for (const [k, v] of prevSnap) snap.set(k, v);
  for (const [k, v] of Object.entries(files)) snap.set(k, v);
  state.commitFileSnapshots.set(id, snap);
  if (!state.branches.has(branch)) state.branches.set(branch, { name: branch, target: id });
  else state.branches.get(branch)!.target = id;
  return id;
}

function setWorkingDir(state: GitState, files: Record<string, { content: string; status: 'untracked' | 'modified' | 'staged' | 'committed' }>) {
  for (const [path, entry] of Object.entries(files)) {
    state.workingDir.set(path, { path, content: entry.content, status: entry.status, stagedContent: entry.status === 'staged' ? entry.content : undefined });
    if (entry.status === 'staged') state.index.add(path);
  }
}

// ---------- Presets ----------

function makeVersionControl(): GitPreset {
  const s = emptyState();
  // folder with untracked files before init, not initialized
  setWorkingDir(s, {
    'README.md': { content: '# My Backend Service\n', status: 'untracked' },
    'app.js': { content: "console.log('hello');\n", status: 'untracked' },
  });
  return {
    id: 'version-control',
    initialState: s,
    objective: {
      title: 'Initialize a repository',
      description: 'This repo is not yet tracked by Git. Run `git init` to create it, then `git status` to verify.',
      hint: 'Try: git init  →  git status  →  git add .  →  git commit -m "initial"',
      winCondition: (state) => state.initialized && state.commits.size >= 1,
      winMessage: '✓ Repository initialized and first commit created!',
    },
  };
}

function makeGitFundamentals(): GitPreset {
  const s = emptyState();
  s.initialized = true;
  s.head = 'main';
  s.branches.set('main', { name: 'main', target: null });
  // initial commit
  addCommit(s, 'feat: initial backend service', { 'README.md': '# Backend Service\n', 'app.js': "console.log('hello');\n" }, 'main');
  const c1 = s.branches.get('main')!.target!;
  addCommit(s, 'feat: add config', { '.gitignore': 'node_modules/\n.env\n', 'app.js': "console.log('hello');\n// config loaded\n" }, 'main');
  const headId = s.branches.get('main')!.target!;
  // Now working dir has modifications: untracked, modified, staged mixture
  // Make workingDir reflect HEAD plus changes
  const snap = s.commitFileSnapshots.get(headId)!;
  s.workingDir.clear();
  s.index.clear();
  for (const [p, c] of snap) s.workingDir.set(p, { path: p, status: 'committed', content: c });
  // add modified file
  s.workingDir.set('app.js', { path: 'app.js', status: 'modified', content: "console.log('hello');\n// config loaded\n// TODO: add routes\n" });
  s.workingDir.set('README.md', { path: 'README.md', status: 'modified', content: '# Backend Service\nUpdated readme\n' });
  s.workingDir.set('notes.txt', { path: 'notes.txt', status: 'untracked', content: 'my notes\n' });
  // stages? none yet

  return {
    id: 'git-fundamentals',
    initialState: s,
    objective: {
      title: 'Stage and commit',
      description: 'You have 2 commits. The working directory is dirty. Stage the changes and create a new commit.',
      hint: 'Use git status to see what changed, git add <file> or git add ., then git commit -m "your message". Try git log --oneline --graph after.',
      winCondition: (state) => {
        const count = state.commits.size;
        return count >= 3 && state.index.size === 0 && Array.from(state.workingDir.values()).every((f) => f.status !== 'modified' && f.status !== 'staged');
      },
      winMessage: '✓ Clean working tree with a new commit!',
    },
  };
}

function makeGitBranching(): GitPreset {
  const s = emptyState();
  s.initialized = true;
  s.head = 'main';
  s.branches.set('main', { name: 'main', target: null });
  addCommit(s, 'Initial commit', { 'app.js': "console.log('v1');\n" }, 'main');
  addCommit(s, 'feat: add login endpoint', { 'app.js': "console.log('v1');\n// login endpoint\n", 'login.js': "export function login(){}\n" }, 'main');
  const mainAfter2 = s.branches.get('main')!.target!;
  // create feature branch from main~0 (at mainAfter2)
  s.branches.set('feature/login', { name: 'feature/login', target: mainAfter2 });
  // advance feature by one commit
  addCommit(s, 'feat: style login form', { 'login.js': "export function login(){ return 'styled'; }\n", 'feature.txt': "feature change: form layout\n" }, 'feature/login');
  // advance main by one divergent commit (creates divergence)
  addCommit(s, 'fix: update main with validation', { 'feature.txt': "main change: validation\n", 'app.js': "console.log('v1');\n// main validation\n" }, 'main');
  // set HEAD to feature/login? Let's keep HEAD on main for merge exercise, but make feature have one commit
  s.head = 'main';
  // Now workingDir reflects main HEAD
  const mainSnap = s.commitFileSnapshots.get(s.branches.get('main')!.target!)!;
  s.workingDir.clear();
  s.index.clear();
  for (const [p, c] of mainSnap) s.workingDir.set(p, { path: p, status: 'committed', content: c });

  return {
    id: 'git-branching',
    initialState: s,
    objective: {
      title: 'Merge the feature branch',
      description: 'main and feature/login have diverged (both modified feature.txt). Merge feature/login into main and resolve the conflict.',
      hint: 'Try: git merge feature/login → see conflict → edit feature.txt (git status, git add feature.txt, git commit -m "resolve") → or git merge --abort to retry. Use git log --oneline --graph --all to visualize.',
      winCondition: (state) => {
        // merged if main contains feature commit via ancestor or merge commit
        const mainTarget = state.branches.get('main')?.target ?? null;
        const featTarget = state.branches.get('feature/login')?.target ?? null;
        if (!mainTarget || !featTarget) return false;
        if (state.conflict) return false;
        // check via simple ancestor check: if main's latest commit has two parents, likely merged
        const latest = state.commits.get(mainTarget);
        if (!latest) return false;
        if (latest.parents.length === 2) return latest.parents.includes(featTarget) || state.commits.has(mainTarget);
        // also check if feature commit is ancestor of main (after rebasing alternative)
        // use helper ancestor
        // inline check
        const visited = new Set<string>();
        const q: string[] = [mainTarget];
        while (q.length) {
          const cur = q.shift()!;
          if (cur === featTarget) return true;
          if (visited.has(cur)) continue;
          visited.add(cur);
          const c = state.commits.get(cur);
          if (c) q.push(...c.parents);
        }
        return false;
      },
      winMessage: '✓ feature/login merged into main!',
    },
  };
}

function makeGitRemotes(): GitPreset {
  const s = emptyState();
  s.initialized = true;
  s.head = 'main';
  s.branches.set('main', { name: 'main', target: null });
  s.remotes.set('origin', { name: 'origin', url: 'https://github.com/you/backend-service.git', branches: new Map(), fetchedCommits: new Map() });
  addCommit(s, 'Initial commit', { 'README.md': '# Service\n' }, 'main');
  const c1 = s.branches.get('main')!.target!;
  addCommit(s, 'feat: add api route', { 'api.js': "export const route='/api';\n" }, 'main');
  const c2 = s.branches.get('main')!.target!;
  // origin tracks c1 (behind by 1)
  s.remotes.get('origin')!.branches.set('main', c1);
  // Also origin has a remote commit not in local? For pull simulation, let's make origin also have a commit ahead separately? For push scenario we want local ahead, so origin behind is enough.
  // Store fetchedCommits for those commits
  for (const [id, c] of s.commits) s.remotes.get('origin')!.fetchedCommits.set(id, { ...c });
  // workingDir clean at c2
  const snap = s.commitFileSnapshots.get(c2)!;
  s.workingDir.clear();
  s.index.clear();
  for (const [p, c] of snap) s.workingDir.set(p, { path: p, status: 'committed', content: c });

  return {
    id: 'git-remotes',
    initialState: s,
    objective: {
      title: 'Sync with origin',
      description: "Local main is ahead of origin/main by 1 commit. Push it, then simulate a remote change and pull it back.",
      hint: 'Check git status, git remote -v, git push origin main, then (in this sandbox) we simulate origin advancing — try git fetch + git pull if diverged.',
      winCondition: (state) => {
        const local = state.branches.get('main')?.target ?? null;
        const remote = state.remotes.get('origin')?.branches.get('main') ?? null;
        if (!local || !remote) return false;
        return local === remote;
      },
      winMessage: '✓ Local and origin are in sync!',
    },
  };
}

function makeGithubWorkflow(): GitPreset {
  const s = emptyState();
  s.initialized = true;
  s.head = 'main';
  s.branches.set('main', { name: 'main', target: null });
  s.remotes.set('origin', { name: 'origin', url: 'https://github.com/you/backend-service.git', branches: new Map(), fetchedCommits: new Map() });
  addCommit(s, 'Initial commit', { 'README.md': '# Service\n', 'ci.yml': 'name: CI\non: [push]\n' }, 'main');
  addCommit(s, 'feat: add auth module', { 'auth.js': "export function auth(){}\n" }, 'main');
  const mainTarget = s.branches.get('main')!.target!;
  s.remotes.get('origin')!.branches.set('main', mainTarget);
  for (const [id, c] of s.commits) s.remotes.get('origin')!.fetchedCommits.set(id, { ...c });
  // create feature/foo branch pushed? Actually we want feature not yet pushed for workflow exercise
  s.branches.set('feature/foo', { name: 'feature/foo', target: mainTarget });
  // add a commit on feature
  addCommit(s, 'feat: add JWT auth', { 'auth.js': "export function auth(){ return 'jwt'; }\n", 'jwt.js': "export const secret='shh';\n" }, 'feature/foo');
  // Switch to feature/foo
  s.head = 'feature/foo';
  const featSnap = s.commitFileSnapshots.get(s.branches.get('feature/foo')!.target!)!;
  s.workingDir.clear();
  s.index.clear();
  for (const [p, c] of featSnap) s.workingDir.set(p, { path: p, status: 'committed', content: c });
  // remote does NOT have feature branch yet
  return {
    id: 'github-workflow',
    initialState: s,
    objective: {
      title: 'Push feature and open a PR',
      description: 'feature/foo has a new commit not on origin. Push it to origin to simulate opening a Pull Request.',
      hint: 'Try: git push -u origin feature/foo  →  then git log --oneline --graph --all to see origin/feature/foo, then merge via git switch main + git merge feature/foo.',
      winCondition: (state) => {
        const remoteFeat = state.remotes.get('origin')?.branches.get('feature/foo') ?? null;
        const localFeat = state.branches.get('feature/foo')?.target ?? null;
        if (!remoteFeat || !localFeat) return false;
        // win if pushed (remote feat exists and equals local) OR if merged into main (main contains feat)
        if (remoteFeat === localFeat) return true;
        // check merged into main
        const mainTarget2 = state.branches.get('main')?.target ?? null;
        if (!mainTarget2) return false;
        // check if feat commit is ancestor of main
        const visited = new Set<string>();
        const q: string[] = [mainTarget2];
        while (q.length) {
          const cur = q.shift()!;
          if (cur === localFeat) return true;
          if (visited.has(cur)) continue;
          visited.add(cur);
          const c = state.commits.get(cur);
          if (c) q.push(...c.parents);
        }
        return false;
      },
      winMessage: '✓ feature/foo pushed (PR ready) or merged!',
    },
  };
}

function makeCicd(): GitPreset {
  const s = emptyState();
  s.initialized = true;
  s.head = 'main';
  s.branches.set('main', { name: 'main', target: null });
  s.remotes.set('origin', { name: 'origin', url: 'https://github.com/you/backend-service.git', branches: new Map(), fetchedCommits: new Map() });
  addCommit(s, 'Initial commit', { 'README.md': '# Service\n' }, 'main');
  addCommit(s, 'feat: service core', { 'service.js': "export function run(){}\n" }, 'main');
  const mainTarget = s.branches.get('main')!.target!;
  s.remotes.get('origin')!.branches.set('main', mainTarget);
  for (const [id, c] of s.commits) s.remotes.get('origin')!.fetchedCommits.set(id, { ...c });
  // Untracked workflow file
  s.workingDir.clear();
  s.index.clear();
  const snap = s.commitFileSnapshots.get(mainTarget)!;
  for (const [p, c] of snap) s.workingDir.set(p, { path: p, status: 'committed', content: c });
  s.workingDir.set('.github/workflows/ci.yml', {
    path: '.github/workflows/ci.yml',
    status: 'untracked',
    content: "name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n",
  });
  return {
    id: 'cicd',
    initialState: s,
    objective: {
      title: 'Commit the CI pipeline',
      description: 'A GitHub Actions workflow is untracked. Add it, commit, and push to trigger CI.',
      hint: 'Try: git add .github/workflows/ci.yml → git commit -m "ci: add pipeline" → git push origin main → git tag v1.0.0',
      winCondition: (state) => {
        const mainTarget2 = state.branches.get('main')?.target ?? null;
        if (!mainTarget2) return false;
        const snap2 = state.commitFileSnapshots.get(mainTarget2);
        if (!snap2?.has('.github/workflows/ci.yml')) return false;
        // also require remote in sync or tag exists
        const remoteMain = state.remotes.get('origin')?.branches.get('main') ?? null;
        if (remoteMain === mainTarget2) return true;
        if (state.tags.has('v1.0.0')) return true;
        // at minimum committed
        return snap2.has('.github/workflows/ci.yml') && state.commits.size >= 3;
      },
      winMessage: '✓ CI workflow committed (and pushed/tagged)!',
    },
  };
}

function makeFree(): GitPreset {
  const s = emptyState();
  s.initialized = true;
  s.head = 'main';
  s.branches.set('main', { name: 'main', target: null });
  addCommit(s, 'Initial commit', { 'README.md': '# Playground\nFree mode: experiment daily.\n' }, 'main');
  const headId = s.branches.get('main')!.target!;
  const snap = s.commitFileSnapshots.get(headId)!;
  s.workingDir.clear();
  s.index.clear();
  for (const [p, c] of snap) s.workingDir.set(p, { path: p, status: 'committed', content: c });
  s.workingDir.set('app.js', { path: 'app.js', status: 'untracked', content: "console.log('play');\n" });
  return {
    id: 'free',
    initialState: s,
    objective: {
      title: 'Free Playground',
      description: 'A sandbox repo. No fixed goal — explore any Git command. Graph and terminal are live.',
      hint: 'Try branching, merging, resetting, stashing. Use git help <command> or the cheat sheet.',
      winCondition: () => false,
      winMessage: '',
    },
  };
}

export const GIT_PRESETS: Record<string, GitPreset> = {
  'version-control': makeVersionControl(),
  'git-fundamentals': makeGitFundamentals(),
  'git-branching': makeGitBranching(),
  'git-remotes': makeGitRemotes(),
  'github-workflow': makeGithubWorkflow(),
  'cicd': makeCicd(),
  free: makeFree(),
};

export function getPreset(id: string): GitPreset | undefined {
  return GIT_PRESETS[id];
}

export function clonePresetState(id: string): GitState | null {
  const p = GIT_PRESETS[id];
  if (!p) return null;
  // deep clone via engine helper? We'll do manual deep clone by recreating new Maps
  // Use structuredClone if available with fallback
  const s = p.initialState;
  return {
    initialized: s.initialized,
    commits: new Map(s.commits),
    branches: new Map(Array.from(s.branches.entries()).map(([k, v]) => [k, { ...v }])),
    head: s.head,
    detachedCommit: s.detachedCommit,
    index: new Set(s.index),
    workingDir: new Map(Array.from(s.workingDir.entries()).map(([k, v]) => [k, { ...v }])),
    remotes: new Map(
      Array.from(s.remotes.entries()).map(([k, v]) => [k, { name: v.name, url: v.url, branches: new Map(v.branches), fetchedCommits: new Map(v.fetchedCommits) }])
    ),
    stash: s.stash.map((e) => ({ ...e, files: new Map(Array.from(e.files.entries()).map(([pk, pv]) => [pk, { ...pv }])) })),
    conflict: s.conflict ? { ...s.conflict } : null,
    config: new Map(s.config),
    commitCounter: s.commitCounter,
    remoteCommitsAhead: new Map(s.remoteCommitsAhead),
    commitFileSnapshots: new Map(Array.from(s.commitFileSnapshots.entries()).map(([k, v]) => [k, new Map(v)])),
    tags: new Map(s.tags),
  };
}
