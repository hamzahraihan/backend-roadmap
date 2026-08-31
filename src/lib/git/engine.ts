import { parseInput } from './parser';
import type { GitState, Commit, ExecResult, Branch, Remote, FileEntry } from './types';

// ---------- utils ----------

function cloneMap<K, V>(m: Map<K, V>, cloneVal?: (v: V) => V): Map<K, V> {
  const n = new Map<K, V>();
  for (const [k, v] of m) n.set(k, cloneVal ? cloneVal(v) : v);
  return n;
}

export function cloneState(s: GitState): GitState {
  return {
    initialized: s.initialized,
    commits: cloneMap(s.commits),
    branches: cloneMap(s.branches, (b) => ({ ...b })),
    head: s.head,
    detachedCommit: s.detachedCommit,
    index: new Set(s.index),
    workingDir: cloneMap(s.workingDir, (f) => ({ ...f })),
    remotes: cloneMap(s.remotes, (r) => ({
      name: r.name,
      url: r.url,
      branches: cloneMap(r.branches),
      fetchedCommits: cloneMap(r.fetchedCommits),
    })),
    stash: s.stash.map((e) => ({ ...e, files: cloneMap(e.files, (f) => ({ ...f })) })),
    conflict: s.conflict ? { ...s.conflict } : null,
    config: cloneMap(s.config),
    commitCounter: s.commitCounter,
    remoteCommitsAhead: cloneMap(s.remoteCommitsAhead),
    commitFileSnapshots: cloneMap(s.commitFileSnapshots, (m) => cloneMap(m)),
    tags: cloneMap(s.tags),
  };
}

function generateCommitId(counter: number): { id: string; shortId: string } {
  const hex = (counter + 0xabc123).toString(16).padStart(7, '0').slice(-7);
  // pad to 40 with deterministic expansion
  const id = (hex + hex + hex + hex + hex + hex).slice(0, 40);
  return { id, shortId: hex };
}

function getCurrentCommitId(state: GitState): string | null {
  if (state.detachedCommit) return state.detachedCommit;
  if (!state.head) return null;
  const br = state.branches.get(state.head);
  return br ? br.target : null;
}

function isAncestor(state: GitState, ancestorId: string | null, descendantId: string | null): boolean {
  if (!ancestorId || !descendantId) return false;
  if (ancestorId === descendantId) return true;
  const visited = new Set<string>();
  const queue: string[] = [descendantId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const c = state.commits.get(cur);
    if (!c) continue;
    for (const p of c.parents) {
      if (p === ancestorId) return true;
      queue.push(p);
    }
  }
  return false;
}

function findMergeBase(state: GitState, a: string | null, b: string | null): string | null {
  if (!a || !b) return null;
  const ancestorsA = new Set<string>();
  const queueA: string[] = [a];
  while (queueA.length) {
    const cur = queueA.shift()!;
    if (ancestorsA.has(cur)) continue;
    ancestorsA.add(cur);
    const c = state.commits.get(cur);
    if (c) queueA.push(...c.parents);
  }
  const queueB: string[] = [b];
  const visitedB = new Set<string>();
  while (queueB.length) {
    const cur = queueB.shift()!;
    if (visitedB.has(cur)) continue;
    visitedB.add(cur);
    if (ancestorsA.has(cur)) return cur;
    const c = state.commits.get(cur);
    if (c) queueB.push(...c.parents);
  }
  return null;
}

function snapshotFromState(state: GitState): Map<string, string> {
  const snap = new Map<string, string>();
  for (const [path, file] of state.workingDir) {
    // staged content takes precedence at commit time, else content
    const content = file.stagedContent !== undefined ? file.stagedContent : file.content;
    // only include non-deleted? For simplicity keep all except deleted
    if (file.status !== 'deleted') snap.set(path, content);
  }
  // also include index only files already covered; workingDir is source of truth
  return snap;
}

function getLogCommits(state: GitState, includeAll: boolean): Commit[] {
  let commits: Commit[];
  if (includeAll) {
    commits = Array.from(state.commits.values());
  } else {
    const target = getCurrentCommitId(state);
    if (!target) return [];
    const reachable = new Set<string>();
    const queue: string[] = [target];
    while (queue.length) {
      const cur = queue.shift()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      const c = state.commits.get(cur);
      if (c) queue.push(...c.parents);
    }
    commits = Array.from(state.commits.values()).filter((c) => reachable.has(c.id));
  }
  return commits.sort((a, b) => b.timestamp - a.timestamp);
}

function formatLog(state: GitState, includeAll: boolean, oneline: boolean, graph: boolean, decorate: boolean): string {
  const commits = getLogCommits(state, includeAll);
  if (commits.length === 0) return 'fatal: your current branch has no commits yet';
  const headId = getCurrentCommitId(state);
  // Build branch decoration map: commitId -> labels[]
  const deco = new Map<string, string[]>();
  for (const [name, br] of state.branches) {
    if (br.target) {
      const arr = deco.get(br.target) ?? [];
      const label = state.head === name ? `HEAD -> ${name}` : name;
      arr.push(label);
      deco.set(br.target, arr);
    }
  }
  for (const [name, remote] of state.remotes) {
    for (const [rbName, cid] of remote.branches) {
      if (cid) {
        const arr = deco.get(cid) ?? [];
        arr.push(`${name}/${rbName}`);
        deco.set(cid, arr);
      }
    }
  }
  for (const [tag, cid] of state.tags) {
    const arr = deco.get(cid) ?? [];
    arr.push(`tag: ${tag}`);
    deco.set(cid, arr);
  }

  const lines: string[] = [];
  for (const c of commits) {
    const labels = deco.get(c.id);
    const decoStr = decorate && labels ? ` (${labels.join(', ')})` : '';
    if (oneline) {
      const prefix = graph ? '* ' : '';
      lines.push(`${prefix}${c.shortId}${decoStr} ${c.message}`);
    } else {
      const prefix = graph ? '* ' : '';
      lines.push(`${prefix}commit ${c.id}${decoStr}`);
      lines.push(`Author: ${c.author}`);
      lines.push(`Date:   ${new Date(c.timestamp).toString()}`);
      lines.push('');
      lines.push(`    ${c.message}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

// ---------- Engine ----------

export class GitEngine {
  state: GitState;

  constructor(initial: GitState) {
    this.state = cloneState(initial);
  }

  clone(): GitEngine {
    return new GitEngine(cloneState(this.state));
  }

  exec(raw: string): { result: ExecResult; newState: GitState } {
    const parsed = parseInput(raw);
    if (!parsed) return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: this.state };

    const { cmd, args, flags } = parsed;
    // bare helpers like `clear`
    if (cmd === 'clear') {
      return { result: { stdout: '__CLEAR__', stderr: '', exitCode: 0 }, newState: this.state };
    }
    if (cmd === 'help' || (cmd === 'git' && args[0] === 'help')) {
      const sub = args[0] === 'help' ? args[1] : args[0];
      return this.handleHelp(sub);
    }

    // Non-git commands
    if (cmd !== 'git') {
      return {
        result: { stdout: '', stderr: `bash: ${cmd}: command not found`, exitCode: 127 },
        newState: this.state,
      };
    }

    if (args.length === 0) {
      return {
        result: { stdout: 'usage: git [--version] [--help] <command> [<args>]', stderr: '', exitCode: 1 },
        newState: this.state,
      };
    }

    const sub = args[0];
    const subArgs = args.slice(1);

    // Commands that work without repo
    if (['init', 'clone', 'config', 'help'].includes(sub)) {
      // dispatch directly
    } else {
      if (!this.state.initialized) {
        return {
          result: {
            stdout: '',
            stderr: `fatal: not a git repository (or any of the parent directories): .git\nhint: Use 'git init' to initialize a repository.`,
            exitCode: 128,
          },
          newState: this.state,
        };
      }
      if (this.state.conflict && sub !== 'add' && sub !== 'commit' && sub !== 'status' && sub !== 'merge' && sub !== 'rebase' && sub !== 'abort') {
        // Allow only resolving commands during conflict, but don't block strictly
      }
    }

    switch (sub) {
      case 'init':
        return this.handleInit(subArgs, flags);
      case 'status':
        return this.handleStatus(subArgs, flags);
      case 'add':
        return this.handleAdd(subArgs, flags);
      case 'commit':
        return this.handleCommit(subArgs, flags);
      case 'log':
        return this.handleLog(subArgs, flags);
      case 'diff':
        return this.handleDiff(subArgs, flags);
      case 'show':
        return this.handleShow(subArgs, flags);
      case 'branch':
        return this.handleBranch(subArgs, flags);
      case 'checkout':
        return this.handleCheckout(subArgs, flags);
      case 'switch':
        return this.handleSwitch(subArgs, flags);
      case 'merge':
        return this.handleMerge(subArgs, flags);
      case 'rebase':
        return this.handleRebase(subArgs, flags);
      case 'remote':
        return this.handleRemote(subArgs, flags);
      case 'fetch':
        return this.handleFetch(subArgs, flags);
      case 'push':
        return this.handlePush(subArgs, flags);
      case 'pull':
        return this.handlePull(subArgs, flags);
      case 'clone':
        return this.handleClone(subArgs, flags);
      case 'reset':
        return this.handleReset(subArgs, flags);
      case 'restore':
        return this.handleRestore(subArgs, flags);
      case 'stash':
        return this.handleStash(subArgs, flags);
      case 'tag':
        return this.handleTag(subArgs, flags);
      case 'cherry-pick':
        return this.handleCherryPick(subArgs, flags);
      case 'revert':
        return this.handleRevert(subArgs, flags);
      case 'blame':
        return this.handleBlame(subArgs, flags);
      case 'bisect':
        return this.handleBisect(subArgs, flags);
      case 'config':
        return this.handleConfig(subArgs, flags);
      default:
        return {
          result: { stdout: '', stderr: `git: '${sub}' is not a git command. See 'git --help'.`, exitCode: 1 },
          newState: this.state,
        };
    }
  }

  private handleHelp(sub?: string): { result: ExecResult; newState: GitState } {
    if (!sub) {
      return {
        result: {
          stdout:
            "usage: git [--version] [--help] <command> [<args>]\n\nThese are common Git commands used in various situations:\n\nstart a working area\n   clone     Clone a repository into a new directory\n   init      Create an empty Git repository\n\nwork on the current change\n   add       Add file contents to the index\n   commit    Record changes to the repository\n   status    Show the working tree status\n   diff      Show changes between commits\n\nbranching\n   branch    List, create, or delete branches\n   checkout  Switch branches or restore files\n   switch    Switch branches\n   merge     Join two or more development histories\n   rebase    Reapply commits on top of another base\n\nhistory\n   log       Show commit logs\n   show      Show various types of objects\n\nremote\n   fetch     Download objects and refs from another repository\n   pull      Fetch from and integrate with another repository\n   push      Update remote refs along with associated objects\n   remote    Manage set of tracked repositories\n\nUse 'git help <command>' for more information.",
          stderr: '',
          exitCode: 0,
        },
        newState: this.state,
      };
    }
    return {
      result: { stdout: `No manual entry for git ${sub}`, stderr: '', exitCode: 0 },
      newState: this.state,
    };
  }

  private handleInit(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    if (this.state.initialized) {
      return {
        result: { stdout: 'Reinitialized existing Git repository in .git/', stderr: '', exitCode: 0 },
        newState: this.state,
      };
    }
    const ns = cloneState(this.state);
    ns.initialized = true;
    // default branch main
    ns.branches.set('main', { name: 'main', target: null });
    ns.head = 'main';
    ns.detachedCommit = null;
    this.state = ns;
    return {
      result: { stdout: 'Initialized empty Git repository in .git/', stderr: '', exitCode: 0 },
      newState: ns,
    };
  }

  private handleStatus(_args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = this.state;
    if (s.conflict) {
      const isStaged = s.index.has(s.conflict.path);
      if (isStaged) {
        return {
          result: {
            stdout: `On branch ${s.head ?? '(detached)'}\nAll conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)\n\nChanges to be committed:\n\tmodified:   ${s.conflict.path}`,
            stderr: '',
            exitCode: 0,
          },
          newState: s,
        };
      }
      return {
        result: {
          stdout: `On branch ${s.head ?? '(detached)'}\nYou have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)\n\nUnmerged paths:\n  (use "git add <file>..." to mark resolution)\n\tboth modified:   ${s.conflict.path}`,
          stderr: '',
          exitCode: 0,
        },
        newState: s,
      };
    }
    const headId = getCurrentCommitId(s);
    const lines: string[] = [];
    lines.push(`On branch ${s.head ?? '(detached HEAD)'}`);
    if (s.head) {
      const remote = s.remotes.get('origin');
      if (remote) {
        const rb = remote.branches.get(s.head);
        if (rb) {
          if (rb !== headId) {
            const isAhead = headId && rb && isAncestor(s, rb, headId) && !isAncestor(s, headId, rb);
            const isBehind = rb && headId && isAncestor(s, headId, rb) && !isAncestor(s, rb, headId);
            const isDiverged = headId && rb && !isAncestor(s, rb, headId) && !isAncestor(s, headId, rb);
            if (isDiverged) lines.push(`Your branch and 'origin/${s.head}' have diverged,`);
            else if (isAhead) lines.push(`Your branch is ahead of 'origin/${s.head}' by 1 commit.`);
            else if (isBehind) lines.push(`Your branch is behind 'origin/${s.head}' by 1 commit.`);
          } else {
            lines.push(`Your branch is up to date with 'origin/${s.head}'.`);
          }
        } else {
          lines.push(`Your branch is based on 'origin/${s.head}', but the upstream is gone.`);
        }
      }
    }
    if (!headId) lines.push('\nNo commits yet');
    const staged: string[] = [];
    const notStaged: string[] = [];
    const untracked: string[] = [];
    for (const [path, file] of s.workingDir) {
      if (file.status === 'staged') staged.push(path);
      else if (file.status === 'modified') notStaged.push(path);
      else if (file.status === 'untracked') untracked.push(path);
    }
    if (staged.length) {
      lines.push('\nChanges to be committed:');
      lines.push(`  (use "git restore --staged <file>..." to unstage)`);
      for (const p of staged) lines.push(`\tmodified:   ${p}`);
    }
    if (notStaged.length) {
      lines.push('\nChanges not staged for commit:');
      lines.push(`  (use "git add <file>..." to update what will be committed)`);
      lines.push(`  (use "git restore <file>..." to discard changes in working directory)`);
      for (const p of notStaged) lines.push(`\tmodified:   ${p}`);
    }
    if (untracked.length) {
      lines.push('\nUntracked files:');
      lines.push(`  (use "git add <file>..." to include in what will be committed)`);
      for (const p of untracked) lines.push(`\t${p}`);
    }
    if (!staged.length && !notStaged.length && !untracked.length) {
      if (headId) lines.push('\nnothing to commit, working tree clean');
      else lines.push('\nnothing to commit (create/copy files and use "git add" to track)');
    }
    return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
  }

  private handleAdd(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    if (args.length === 0 && !flags.has('A') && !flags.has('all')) {
      return { result: { stdout: '', stderr: 'Nothing specified, nothing added.', exitCode: 1 }, newState: this.state };
    }
    const targets = args.length === 0 ? ['.'] : args;
    let added: string[] = [];
    for (const t of targets) {
      if (t === '.' || t === '-A' || t === '--all') {
        for (const [path, file] of s.workingDir) {
          if (file.status === 'untracked' || file.status === 'modified' || file.status === 'deleted') {
            // mark resolved but keep conflict pending until commit (so commit can add second parent)
            // we keep s.conflict; just stage the file
            file.status = 'staged';
            file.stagedContent = file.content;
            s.index.add(path);
            added.push(path);
          }
        }
      } else {
        const file = s.workingDir.get(t);
        if (!file) {
          return {
            result: { stdout: '', stderr: `fatal: pathspec '${t}' did not match any files`, exitCode: 1 },
            newState: this.state,
          };
        }
        // keep conflict pending until commit - just stage
        // if (s.conflict && s.conflict.path === t) { /* keep */ }
        file.status = 'staged';
        file.stagedContent = file.content;
        s.index.add(t);
        added.push(t);
      }
    }
    // if conflict resolved and no more conflict, clear conflict? handled per file
    this.state = s;
    return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
  }

  private handleCommit(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const msg = flags.get('m') as string | undefined;
    const amend = flags.has('amend');
    if (!msg) {
      return {
        result: {
          stdout: '',
          stderr: 'Aborting commit due to empty commit message.\nhint: Use `git commit -m "message"`',
          exitCode: 1,
        },
        newState: this.state,
      };
    }
    const s = cloneState(this.state);
    // if in conflict, this is a merge commit resolving conflict
    const isMergeResolving = !!s.conflict || (!!s.branches.get(s.head ?? '') && this.state.conflict);
    const stagedFiles = Array.from(s.index);
    // Allow commit if staging or conflict resolving or amend
    if (stagedFiles.length === 0 && !isMergeResolving && !s.conflict) {
      return {
        result: {
          stdout: '',
          stderr: `On branch ${s.head ?? '(detached)'}\n${s.conflict ? 'All conflicts fixed but you are still merging.\n' : ''}nothing to commit, working tree clean`,
          exitCode: 1,
        },
        newState: this.state,
      };
    }
    const currentId = getCurrentCommitId(s);
    // For amend, replace last commit
    let parents: string[] = [];
    let message = msg as string;
    if (amend && currentId) {
      const last = s.commits.get(currentId);
      if (last) {
        parents = [...last.parents];
        // remove old commit? keep but orphan? Simpler replace target to new commit, delete old
        s.commits.delete(currentId);
        s.commitFileSnapshots.delete(currentId);
      } else {
        parents = [];
      }
    } else {
      parents = currentId ? [currentId] : [];
      // if resolving a merge conflict, there are two parents
      if (s.conflict) {
        // need incoming branch target as second parent
        const incoming = s.conflict.incomingBranch;
        const incBr = s.branches.get(incoming);
        if (incBr?.target) parents.push(incBr.target);
      } else if (this.state.conflict) {
        // fallback from original state before add cleared it, need second parent from its conflict
        const inc = this.state.conflict.incomingBranch;
        const incBr = s.branches.get(inc);
        if (incBr?.target) {
          // Ensure we have two parents but not duplicate
          if (!parents.includes(incBr.target)) parents.push(incBr.target);
        }
      }
      // Check if we are in a merge that hasn't yet created conflict but has second parent pending?
      // We store pendingMerge in stash? No, for merge conflict we already set conflict.
      // After conflict resolved, this path includes second parent.
    }

    const counter = s.commitCounter + 1;
    const { id, shortId } = generateCommitId(counter);
    s.commitCounter = counter;
    const commit: Commit = {
      id,
      shortId,
      message: message,
      parents,
      author: s.config.get('user.name') ?? 'You <you@example.com>',
      timestamp: Date.now() + counter * 1000,
      branchAtCreation: s.head ?? 'HEAD',
    };
    s.commits.set(id, commit);
    // Snapshot
    const snap = snapshotFromState(s);
    s.commitFileSnapshots.set(id, snap);

    // Update branch pointer
    if (s.head) {
      const br = s.branches.get(s.head);
      if (br) {
        br.target = id;
        s.branches.set(s.head, br);
      } else {
        s.branches.set(s.head, { name: s.head, target: id });
      }
    } else if (s.detachedCommit) {
      s.detachedCommit = id;
    }

    // Clear index and mark workingDir as committed (but keep modified files? In real git, after commit workingDir matches committed)
    s.index.clear();
    for (const [path, file] of s.workingDir) {
      if (file.status === 'staged') {
        file.status = 'committed';
        file.content = file.stagedContent ?? file.content;
        file.stagedContent = undefined;
      }
    }
    s.conflict = null;

    this.state = s;
    const branchName = s.head ?? '(detached HEAD)';
    const out = `[${branchName} ${shortId}] ${message}\n ${parents.length > 1 ? `${parents.length} parents` : '1 file changed'}`;
    return { result: { stdout: out, stderr: '', exitCode: 0 }, newState: s };
  }

  private handleLog(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    // args could be --oneline, --graph, --all, --decorate etc. Also flags map has them.
    const rawJoined = args.join(' ') + ' ' + Array.from(flags.keys()).join(' ');
    const oneline = rawJoined.includes('oneline') || flags.has('oneline') || args.includes('--oneline');
    const graph = rawJoined.includes('graph') || flags.has('graph') || args.includes('--graph');
    const all = rawJoined.includes('all') || flags.has('all') || args.includes('--all');
    const decorate = true; // default show decorations; can disable with --no-decorate not needed
    const out = formatLog(this.state, all, oneline, graph, decorate);
    return { result: { stdout: out, stderr: '', exitCode: 0 }, newState: this.state };
  }

  private handleDiff(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const cached = flags.has('staged') || flags.has('cached') || args.includes('--staged') || args.includes('--cached');
    const s = this.state;
    if (cached) {
      // diff between index and HEAD
      const headId = getCurrentCommitId(s);
      const headSnap = headId ? s.commitFileSnapshots.get(headId) : new Map<string, string>();
      const lines: string[] = [];
      for (const path of s.index) {
        const file = s.workingDir.get(path);
        if (!file) continue;
        const headContent = headSnap?.get(path) ?? '';
        const staged = file.stagedContent ?? file.content;
        if (headContent !== staged) {
          lines.push(`diff --git a/${path} b/${path}`);
          lines.push(`--- a/${path}`);
          lines.push(`+++ b/${path}`);
          lines.push(`-${headContent}`);
          lines.push(`+${staged}`);
        }
      }
      if (!lines.length) return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    } else {
      // diff working dir vs index
      const lines: string[] = [];
      for (const [path, file] of s.workingDir) {
        if (file.status === 'modified') {
          const staged = file.stagedContent ?? '';
          const content = file.content;
          // if staged exists, compare content vs staged, else vs HEAD?
          // For simplicity, show working vs staged if staged exists else working vs committed snapshot
          if (staged && staged !== content) {
            lines.push(`diff --git a/${path} b/${path}`);
            lines.push(`--- a/${path}`);
            lines.push(`+++ b/${path}`);
            lines.push(`-${staged}`);
            lines.push(`+${content}`);
          } else if (!staged) {
            const headId = getCurrentCommitId(s);
            const headSnap = headId ? s.commitFileSnapshots.get(headId) : undefined;
            const base = headSnap?.get(path) ?? '';
            if (base !== content) {
              lines.push(`diff --git a/${path} b/${path}`);
              lines.push(`--- a/${path}`);
              lines.push(`+++ b/${path}`);
              lines.push(`-${base}`);
              lines.push(`+${content}`);
            }
          }
        } else if (file.status === 'untracked') {
          lines.push(`diff --git a/${path} b/${path} (untracked)`);
          lines.push(`+${file.content}`);
        }
      }
      if (!lines.length) return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
  }

  private handleShow(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const target = args[0] ?? 'HEAD';
    let commitId: string | null = null;
    if (target === 'HEAD') commitId = getCurrentCommitId(this.state);
    else {
      // try shortId match, branch name, tag
      commitId = this.resolveRef(target);
    }
    if (!commitId) return { result: { stdout: '', stderr: `fatal: ambiguous argument '${target}': unknown revision`, exitCode: 128 }, newState: this.state };
    const commit = this.state.commits.get(commitId);
    if (!commit) return { result: { stdout: '', stderr: `fatal: bad object ${commitId}`, exitCode: 128 }, newState: this.state };
    const snap = this.state.commitFileSnapshots.get(commitId);
    const lines: string[] = [];
    lines.push(`commit ${commit.id}${commit.parents.length > 1 ? ` (Merge: ${commit.parents.map((p) => this.state.commits.get(p)?.shortId ?? p.slice(0, 7)).join(' ')})` : ''}`);
    lines.push(`Author: ${commit.author}`);
    lines.push(`Date:   ${new Date(commit.timestamp).toString()}`);
    lines.push('');
    lines.push(`    ${commit.message}`);
    lines.push('');
    if (snap) {
      for (const [path, content] of snap) {
        lines.push(`diff --git a/${path} b/${path}`);
        lines.push(content);
      }
    }
    return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: this.state };
  }

  private resolveRef(ref: string): string | null {
    // branch
    if (this.state.branches.has(ref)) return this.state.branches.get(ref)!.target;
    // tag
    if (this.state.tags.has(ref)) return this.state.tags.get(ref)!;
    // commit id short/long
    for (const [id, c] of this.state.commits) {
      if (id === ref || c.shortId === ref || id.startsWith(ref)) return id;
    }
    // HEAD~n
    if (ref.startsWith('HEAD~')) {
      const n = parseInt(ref.slice(5), 10) || 1;
      let cur = getCurrentCommitId(this.state);
      for (let i = 0; i < n && cur; i++) {
        const c = this.state.commits.get(cur);
        cur = c?.parents[0] ?? null;
      }
      return cur;
    }
    if (ref === 'HEAD') return getCurrentCommitId(this.state);
    return null;
  }

  private handleBranch(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    // flags: -d, -D, -a, -r, -v etc
    const s = cloneState(this.state);
    if (args.length === 0 && flags.size === 0) {
      // list
      const lines: string[] = [];
      for (const [name, br] of s.branches) {
        const current = name === s.head ? '* ' : '  ';
        lines.push(`${current}${name}`);
      }
      this.state = s;
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
    if (flags.has('d') || flags.has('D')) {
      const force = flags.has('D');
      const name = args[0];
      if (!name) return { result: { stdout: '', stderr: 'branch name required', exitCode: 1 }, newState: this.state };
      if (name === s.head) return { result: { stdout: '', stderr: `error: cannot delete branch '${name}' checked out at '${name}'`, exitCode: 1 }, newState: this.state };
      if (!s.branches.has(name)) return { result: { stdout: '', stderr: `error: branch '${name}' not found.`, exitCode: 1 }, newState: this.state };
      const br = s.branches.get(name)!;
      const headId = getCurrentCommitId(s);
      const isMerged = br.target ? (headId ? isAncestor(s, br.target, headId) : false) : true;
      if (!isMerged && !force) {
        return {
          result: {
            stdout: '',
            stderr: `error: The branch '${name}' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D ${name}'.`,
            exitCode: 1,
          },
          newState: this.state,
        };
      }
      s.branches.delete(name);
      this.state = s;
      return { result: { stdout: `Deleted branch ${name} (was ${br.target?.slice(0, 7) ?? 'no commit'}).`, stderr: '', exitCode: 0 }, newState: s };
    }
    if (args.length === 1 && !flags.has('a') && !flags.has('r')) {
      // create
      const name = args[0];
      if (s.branches.has(name)) return { result: { stdout: '', stderr: `fatal: A branch named '${name}' already exists.`, exitCode: 128 }, newState: this.state };
      const target = getCurrentCommitId(s);
      s.branches.set(name, { name, target });
      this.state = s;
      return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
    }
    // -a, -r, -vv list all
    if (flags.has('a') || args.includes('-a') || args.includes('--all')) {
      const lines: string[] = [];
      for (const [name, br] of s.branches) {
        const current = name === s.head ? '* ' : '  ';
        lines.push(`${current}${name}`);
      }
      for (const [rName, remote] of s.remotes) {
        for (const [rb, cid] of remote.branches) {
          lines.push(`  remotes/${rName}/${rb}`);
        }
      }
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
    return { result: { stdout: '', stderr: `branch: unknown option`, exitCode: 1 }, newState: this.state };
  }

  private handleCheckout(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    // git checkout <branch>   or -b <new>
    const s = cloneState(this.state);
    const create = flags.has('b');
    if (create) {
      const newName = args[0];
      if (!newName) return { result: { stdout: '', stderr: `fatal: branch name required`, exitCode: 1 }, newState: this.state };
      if (s.branches.has(newName)) return { result: { stdout: '', stderr: `fatal: A branch named '${newName}' already exists.`, exitCode: 1 }, newState: this.state };
      const target = getCurrentCommitId(s);
      s.branches.set(newName, { name: newName, target });
      s.head = newName;
      s.detachedCommit = null;
      // update workingDir to target snapshot (if any)
      this.restoreWorkingDirToCommit(s, target);
      this.state = s;
      return { result: { stdout: `Switched to a new branch '${newName}'`, stderr: '', exitCode: 0 }, newState: s };
    }
    if (args.length === 0) return { result: { stdout: '', stderr: `error: you must specify a branch name`, exitCode: 1 }, newState: this.state };
    const name = args[0] === '-' ? args[0] : args[0];
    if (name === '--') return { result: { stdout: '', stderr: `did not match any file(s)`, exitCode: 1 }, newState: this.state };
    // checkout file? e.g., git checkout -- file  - simplistic: restore file
    if (args[0] === '--' || (args.length > 1 && args[0] === '--')) {
      const path = args[1];
      if (!path) return { result: { stdout: '', stderr: `error: pathspec required`, exitCode: 1 }, newState: this.state };
      const headId = getCurrentCommitId(s);
      const snap = headId ? s.commitFileSnapshots.get(headId) : undefined;
      if (snap?.has(path)) {
        const content = snap.get(path)!;
        const f = s.workingDir.get(path);
        if (f) {
          f.content = content;
          f.status = 'committed';
          f.stagedContent = undefined;
        }
        s.index.delete(path);
        this.state = s;
        return { result: { stdout: `Updated 1 path from HEAD`, stderr: '', exitCode: 0 }, newState: s };
      }
      return { result: { stdout: '', stderr: `error: pathspec '${path}' did not match any file(s) known to git`, exitCode: 1 }, newState: this.state };
    }
    // branch checkout
    if (!s.branches.has(name)) {
      // also check remote branches like origin/main?
      for (const [_rName, remote] of s.remotes) {
        if (remote.branches.has(name) || name.includes('/')) {
          // try to create tracking branch
          const [r, ...rest] = name.split('/');
          const rb = rest.join('/');
          const rem = s.remotes.get(r);
          if (rem && rem.branches.has(rb)) {
            // create local branch tracking
            const target = rem.branches.get(rb)!;
            const localName = rb;
            if (!s.branches.has(localName)) s.branches.set(localName, { name: localName, target, upstream: name });
            s.head = localName;
            this.restoreWorkingDirToCommit(s, target);
            this.state = s;
            return { result: { stdout: `Branch '${localName}' set up to track remote branch '${name}' from 'origin'.`, stderr: '', exitCode: 0 }, newState: s };
          }
        }
      }
      return { result: { stdout: '', stderr: `error: pathspec '${name}' did not match any file(s) known to git`, exitCode: 1 }, newState: this.state };
    }
    if (s.head === name) return { result: { stdout: `Already on '${name}'`, stderr: '', exitCode: 0 }, newState: s };
    // check for uncommitted changes? For simplicity allow.
    s.head = name;
    s.detachedCommit = null;
    const target = s.branches.get(name)!.target;
    this.restoreWorkingDirToCommit(s, target);
    this.state = s;
    return { result: { stdout: `Switched to branch '${name}'`, stderr: '', exitCode: 0 }, newState: s };
  }

  private handleSwitch(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    // git switch <branch>  or -c <new>
    const cloneFlags = new Map(flags);
    // switch -c maps to checkout -b
    if (cloneFlags.has('c')) {
      cloneFlags.delete('c');
      cloneFlags.set('b', true);
    }
    if (cloneFlags.has('C')) {
      cloneFlags.delete('C');
      cloneFlags.set('b', true);
    }
    return this.handleCheckout(args, cloneFlags);
  }

  private restoreWorkingDirToCommit(s: GitState, commitId: string | null) {
    if (!commitId) {
      // no commits yet, keep current workingDir but mark everything accordingly? Keep.
      return;
    }
    const snap = s.commitFileSnapshots.get(commitId);
    if (!snap) return;
    // For simplicity, replace workingDir with snapshot plus keep untracked not in snap
    const newWD = new Map<string, FileEntry>();
    for (const [path, content] of snap) {
      newWD.set(path, { path, status: 'committed', content });
    }
    // Preserve untracked files that are not in snapshot and not staged? Actually checkout should not preserve them if they conflict, but we keep.
    for (const [path, file] of s.workingDir) {
      if (!snap.has(path) && file.status === 'untracked') newWD.set(path, { ...file });
      if (!snap.has(path) && file.status === 'staged') {
        // Keep staged? In real switching with staged changes may fail; we keep.
        newWD.set(path, { ...file });
      }
    }
    s.workingDir = newWD;
    // clear index except for preserved? In real after checkout index matches HEAD
    s.index.clear();
  }

  private handleMerge(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    if (args.length === 0) return { result: { stdout: '', stderr: 'fatal: No branch specified to merge', exitCode: 1 }, newState: this.state };
    // handle --abort
    if (flags.has('abort') || args.includes('--abort')) {
      if (!this.state.conflict) return { result: { stdout: '', stderr: 'fatal: There is no merge to abort (MERGE_HEAD missing).', exitCode: 128 }, newState: this.state };
      const ns = cloneState(this.state);
      ns.conflict = null;
      // restore HEAD files? For simplicity clear conflict and reset workingDir to head snapshot
      const headId = getCurrentCommitId(ns);
      if (headId) this.restoreWorkingDirToCommit(ns, headId);
      this.state = ns;
      return { result: { stdout: 'Merge aborted.', stderr: '', exitCode: 0 }, newState: ns };
    }
    const otherBranchName = args[0];
    const s = cloneState(this.state);
    const currentBranch = s.head;
    if (!currentBranch) return { result: { stdout: '', stderr: 'fatal: You are not currently on a branch.', exitCode: 128 }, newState: this.state };
    const otherBranch = s.branches.get(otherBranchName);
    if (!otherBranch) return { result: { stdout: '', stderr: `fatal: '${otherBranchName}' - not something we can merge`, exitCode: 128 }, newState: this.state };
    if (otherBranchName === currentBranch) return { result: { stdout: '', stderr: 'Already up to date.', exitCode: 0 }, newState: s };
    const currentTarget = s.branches.get(currentBranch)!.target;
    const otherTarget = otherBranch.target;
    if (!otherTarget) return { result: { stdout: '', stderr: `fatal: refusing to merge unrelated histories`, exitCode: 128 }, newState: this.state };
    if (!currentTarget) {
      // fast-forward: current has no commits, just move
      s.branches.get(currentBranch)!.target = otherTarget;
      this.restoreWorkingDirToCommit(s, otherTarget);
      this.state = s;
      return { result: { stdout: `Fast-forward: ${currentBranch} -> ${otherBranchName}`, stderr: '', exitCode: 0 }, newState: s };
    }
    if (isAncestor(s, currentTarget, otherTarget)) {
      // fast-forward
      s.branches.get(currentBranch)!.target = otherTarget;
      this.restoreWorkingDirToCommit(s, otherTarget);
      this.state = s;
      return {
        result: { stdout: `Updating ${currentTarget.slice(0, 7)}..${otherTarget.slice(0, 7)}\nFast-forward`, stderr: '', exitCode: 0 },
        newState: s,
      };
    }
    if (isAncestor(s, otherTarget, currentTarget)) {
      return { result: { stdout: 'Already up to date.', stderr: '', exitCode: 0 }, newState: s };
    }
    // Need to check for conflicts
    const baseId = findMergeBase(s, currentTarget, otherTarget);
    const baseSnap = baseId ? s.commitFileSnapshots.get(baseId) : new Map<string, string>();
    const curSnap = s.commitFileSnapshots.get(currentTarget) ?? new Map<string, string>();
    const otherSnap = s.commitFileSnapshots.get(otherTarget) ?? new Map<string, string>();
    // collect all paths
    const allPaths = new Set<string>([...(baseSnap?.keys() ?? []), ...curSnap.keys(), ...otherSnap.keys()]);
    for (const path of allPaths) {
      const base = baseSnap?.get(path);
      const cur = curSnap.get(path);
      const oth = otherSnap.get(path);
      const curChanged = base !== cur;
      const othChanged = base !== oth;
      if (curChanged && othChanged && cur !== oth) {
        // conflict
        s.conflict = {
          path,
          currentBranch,
          incomingBranch: otherBranchName,
          currentContent: cur ?? '',
          incomingContent: oth ?? '',
        };
        // write conflict markers to workingDir
        const conflictContent = `<<<<<<< HEAD\n${cur ?? ''}\n=======\n${oth ?? ''}\n>>>>>>> ${otherBranchName}\n`;
        const existing = s.workingDir.get(path);
        if (existing) {
          existing.content = conflictContent;
          existing.status = 'modified';
          existing.stagedContent = undefined;
        } else {
          s.workingDir.set(path, { path, status: 'modified', content: conflictContent });
        }
        this.state = s;
        // Also leave staged? No.
        return {
          result: {
            stdout: `Auto-merging ${path}\nCONFLICT (content): Merge conflict in ${path}\nAutomatic merge failed; fix conflicts and then commit the result.`,
            stderr: '',
            exitCode: 1,
          },
          newState: s,
        };
      }
    }
    // No conflict: create merge commit
    const counter = s.commitCounter + 1;
    const { id, shortId } = generateCommitId(counter);
    s.commitCounter = counter;
    const mergeCommit: Commit = {
      id,
      shortId,
      message: `Merge branch '${otherBranchName}' into ${currentBranch}`,
      parents: [currentTarget, otherTarget],
      author: s.config.get('user.name') ?? 'You <you@example.com>',
      timestamp: Date.now() + counter * 1000,
      branchAtCreation: currentBranch,
    };
    s.commits.set(id, mergeCommit);
    // Merge snapshots: take curSnap plus otherSnap changes
    const mergedSnap = new Map<string, string>(curSnap);
    for (const [p, c] of otherSnap) {
      if (!mergedSnap.has(p) || baseSnap?.get(p) !== c) mergedSnap.set(p, c);
    }
    s.commitFileSnapshots.set(id, mergedSnap);
    s.branches.get(currentBranch)!.target = id;
    this.restoreWorkingDirToCommit(s, id);
    this.state = s;
    return {
      result: { stdout: `Merge made by the 'ort' strategy.\n ${pathSummary(mergedSnap)}`, stderr: '', exitCode: 0 },
      newState: s,
    };
  }

  private handleRebase(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    if (args.length === 0) return { result: { stdout: '', stderr: 'fatal: No rebase target specified', exitCode: 1 }, newState: this.state };
    const s = cloneState(this.state);
    const baseBranchName = args[0];
    const currentBranch = s.head;
    if (!currentBranch) return { result: { stdout: '', stderr: 'fatal: No branch checked out', exitCode: 1 }, newState: this.state };
    if (baseBranchName === currentBranch) return { result: { stdout: '', stderr: 'Current branch is up to date.', exitCode: 0 }, newState: s };
    const baseBranch = s.branches.get(baseBranchName);
    const curBranch = s.branches.get(currentBranch)!;
    if (!baseBranch) return { result: { stdout: '', stderr: `fatal: invalid upstream '${baseBranchName}'`, exitCode: 128 }, newState: this.state };
    const baseTarget = baseBranch.target;
    const curTarget = curBranch.target;
    if (!curTarget || !baseTarget) return { result: { stdout: '', stderr: 'cannot rebase: branch has no commits', exitCode: 1 }, newState: this.state };
    if (isAncestor(s, baseTarget, curTarget)) {
      // already contains base
      return { result: { stdout: 'Current branch is up to date.', stderr: '', exitCode: 0 }, newState: s };
    }
    // Find merge base
    const baseId = findMergeBase(s, curTarget, baseTarget);
    // Collect commits unique to current branch (from currentTarget down to baseId exclusive)
    const toRebase: Commit[] = [];
    let cur: string | null = curTarget;
    while (cur && cur !== baseId) {
      const c = s.commits.get(cur);
      if (!c) break;
      toRebase.push(c);
      cur = c.parents[0] ?? null;
    }
    toRebase.reverse();
    if (toRebase.length === 0) return { result: { stdout: 'Current branch is up to date.', stderr: '', exitCode: 0 }, newState: s };
    // Check conflicts similar to merge for each commit (simplified: check if base and cur changed same file)
    // For simplicity, assume no conflicts unless rebase contains feature.txt divergence
    // Do rebase: replay each commit on top of baseTarget
    let lastId = baseTarget;
    const newCommits: Commit[] = [];
    for (const orig of toRebase) {
      const counter = s.commitCounter + 1;
      const { id, shortId } = generateCommitId(counter);
      s.commitCounter = counter;
      const newCommit: Commit = {
        id,
        shortId,
        message: orig.message,
        parents: [lastId],
        author: orig.author,
        timestamp: Date.now() + counter * 1000,
        branchAtCreation: currentBranch,
      };
      // snapshot: start from lastId snapshot plus changes from orig relative to its parent
      const parentSnap = orig.parents[0] ? s.commitFileSnapshots.get(orig.parents[0]) : new Map<string, string>();
      const origSnap = s.commitFileSnapshots.get(orig.id) ?? new Map<string, string>();
      const lastSnap = s.commitFileSnapshots.get(lastId) ?? new Map<string, string>();
      const newSnap = new Map<string, string>(lastSnap);
      // apply diff parentSnap -> origSnap
      for (const [p, content] of origSnap) {
        const baseContent = parentSnap?.get(p);
        if (baseContent !== content) newSnap.set(p, content);
      }
      for (const p of parentSnap?.keys() ?? []) {
        if (!origSnap.has(p)) newSnap.delete(p);
      }
      s.commits.set(id, newCommit);
      s.commitFileSnapshots.set(id, newSnap);
      lastId = id;
      newCommits.push(newCommit);
    }
    // Update branch pointer
    curBranch.target = lastId;
    this.restoreWorkingDirToCommit(s, lastId);
    this.state = s;
    return {
      result: {
        stdout: `Successfully rebased and updated refs/heads/${currentBranch}.\nRebased ${toRebase.length} commit(s) onto ${baseBranchName}`,
        stderr: '',
        exitCode: 0,
      },
      newState: s,
    };
  }

  private handleRemote(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    const sub = args[0];
    if (!sub || sub === '' || flags.has('v') || sub === '-v' || args.includes('-v')) {
      // list
      const lines: string[] = [];
      for (const [name, remote] of s.remotes) {
        lines.push(`${name}\t${remote.url} (fetch)`);
        lines.push(`${name}\t${remote.url} (push)`);
      }
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
    if (sub === 'add') {
      const name = args[1];
      const url = args[2];
      if (!name || !url) return { result: { stdout: '', stderr: 'usage: git remote add <name> <url>', exitCode: 1 }, newState: this.state };
      if (s.remotes.has(name)) return { result: { stdout: '', stderr: `fatal: remote ${name} already exists.`, exitCode: 128 }, newState: this.state };
      s.remotes.set(name, { name, url, branches: new Map(), fetchedCommits: new Map() });
      this.state = s;
      return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
    }
    if (sub === 'remove' || sub === 'rm') {
      const name = args[1];
      if (!name) return { result: { stdout: '', stderr: 'usage: git remote remove <name>', exitCode: 1 }, newState: this.state };
      if (!s.remotes.has(name)) return { result: { stdout: '', stderr: `fatal: No such remote: '${name}'`, exitCode: 128 }, newState: this.state };
      s.remotes.delete(name);
      this.state = s;
      return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
    }
    if (sub === '-v' || sub === '--verbose') {
      const lines: string[] = [];
      for (const [name, remote] of s.remotes) {
        lines.push(`${name}\t${remote.url} (fetch)`);
        lines.push(`${name}\t${remote.url} (push)`);
      }
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
    return { result: { stdout: '', stderr: `unknown subcommand: ${sub}`, exitCode: 1 }, newState: this.state };
  }

  private handleFetch(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    const remoteName = args[0] ?? 'origin';
    const remote = s.remotes.get(remoteName);
    if (!remote) return { result: { stdout: '', stderr: `fatal: '${remoteName}' does not appear to be a git repository`, exitCode: 128 }, newState: this.state };
    // Simulate fetching: copy commits from remote's branches? In our model, remote branches map is already tracking remote state.
    // For simplicity, fetch just confirms and copies remote branches to fetchedCommits? No actual change needed because push/pull manipulate it.
    // We'll copy commits that are in remote branches into commits map if missing.
    let fetched = 0;
    for (const [_rb, cid] of remote.branches) {
      if (cid && !s.commits.has(cid)) {
        // try to find fetchedCommit
        const c = remote.fetchedCommits.get(cid);
        if (c) {
          s.commits.set(cid, { ...c });
          const snap = remote.fetchedCommits.get(cid + '_snap' as string); // not stored
          fetched++;
        }
      }
    }
    this.state = s;
    return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
  }

  private handlePush(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    // parse remote and branch: git push [remote] [branch] [--force]
    const force = flags.has('force') || flags.has('f');
    let remoteName = 'origin';
    let branchName = s.head ?? '';
    // args could be ["origin", "main"] or ["-u", "origin", "main"] etc.
    const nonFlagArgs = args.filter((a) => !a.startsWith('-'));
    // handle -u / --set-upstream
    if (nonFlagArgs.length >= 2) {
      remoteName = nonFlagArgs[0];
      branchName = nonFlagArgs[1];
    } else if (nonFlagArgs.length === 1) {
      // could be branch or remote
      if (s.remotes.has(nonFlagArgs[0])) remoteName = nonFlagArgs[0];
      else branchName = nonFlagArgs[0];
    }
    const remote = s.remotes.get(remoteName);
    if (!remote) return { result: { stdout: '', stderr: `fatal: '${remoteName}' does not appear to be a git repository`, exitCode: 128 }, newState: this.state };
    const localBranch = s.branches.get(branchName);
    if (!localBranch) return { result: { stdout: '', stderr: `error: src refspec ${branchName} does not match any`, exitCode: 1 }, newState: this.state };
    const localTarget = localBranch.target;
    if (!localTarget) return { result: { stdout: '', stderr: `error: failed to push some refs to '${remote.url}'\n hint: Updates were rejected because the remote contains work that you do not have locally.`, exitCode: 1 }, newState: this.state };
    const remoteTarget = remote.branches.get(branchName) ?? null;

    // Check if push would be non-fast-forward
    if (remoteTarget && !isAncestor(s, remoteTarget, localTarget) && !force) {
      return {
        result: {
          stdout: `To ${remote.url}\n ! [rejected]        ${branchName} -> ${branchName} (non-fast-forward)`,
          stderr: `error: failed to push some refs to '${remote.url}'\nhint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart. Integrate the remote changes (e.g.\n hint: 'git pull') before pushing again.`,
          exitCode: 1,
        },
        newState: this.state,
      };
    }
    // Push succeeds: copy commits reachable from localTarget but not in remote? For simplicity just set remote branch.
    remote.branches.set(branchName, localTarget);
    // Also copy commit objects to remote's fetchedCommits for fetch simulation
    // Ensure all commits reachable are in remote's store
    const reachable = new Set<string>();
    const queue: string[] = [localTarget];
    while (queue.length) {
      const cur = queue.shift()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      const c = s.commits.get(cur);
      if (c) queue.push(...c.parents);
    }
    for (const cid of reachable) {
      const c = s.commits.get(cid);
      if (c) remote.fetchedCommits.set(cid, { ...c });
      const snap = s.commitFileSnapshots.get(cid);
      if (snap) remote.fetchedCommits.set(cid + '_snap' as string, { id: cid, shortId: c?.shortId ?? '', message: '', parents: [], author: '', timestamp: 0, branchAtCreation: '' } as any);
      // store snapshot separately? We reuse commitFileSnapshots as source; remote doesn't need its own snapshot map for push
    }
    // Also ensure commits exist in local commits map (they do)
    // Set upstream if -u
    if (args.includes('-u') || flags.has('u') || args.includes('--set-upstream')) {
      localBranch.upstream = `${remoteName}/${branchName}`;
    }
    this.state = s;
    const out = `Enumerating objects: 3, done.\nWriting objects: 100% (3/3)\nTo ${remote.url}\n   ${remoteTarget ? remoteTarget.slice(0, 7) : '0000000'}..${localTarget.slice(0, 7)}  ${branchName} -> ${branchName}`;
    return { result: { stdout: out, stderr: '', exitCode: 0 }, newState: s };
  }

  private handlePull(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    // pull is fetch + merge
    const s = cloneState(this.state);
    let remoteName = 'origin';
    let branchName = s.head ?? '';
    const nonFlagArgs = args.filter((a) => !a.startsWith('-'));
    if (nonFlagArgs.length >= 2) {
      remoteName = nonFlagArgs[0];
      branchName = nonFlagArgs[1];
    } else if (nonFlagArgs.length === 1) {
      if (s.remotes.has(nonFlagArgs[0])) remoteName = nonFlagArgs[0];
      else branchName = nonFlagArgs[0];
    }
    const remote = s.remotes.get(remoteName);
    if (!remote) return { result: { stdout: '', stderr: `fatal: '${remoteName}' does not appear to be a git repository`, exitCode: 128 }, newState: this.state };
    const remoteTarget = remote.branches.get(branchName) ?? remote.branches.get(s.head ?? '') ?? null;
    if (!remoteTarget) return { result: { stdout: '', stderr: `fatal: couldn't find remote ref ${branchName}`, exitCode: 1 }, newState: this.state };
    // need to ensure commit exists locally (fetch)
    if (!s.commits.has(remoteTarget)) {
      const fetched = remote.fetchedCommits.get(remoteTarget);
      if (fetched) {
        s.commits.set(remoteTarget, { ...fetched });
        // retrieve snapshots? we need snapshot from remote's store; we saved snapshot via commits? For our preset, remote commits are already in local map but with divergence?
        // For simplicity, if snapshot missing, create empty snapshot
        if (!s.commitFileSnapshots.has(remoteTarget)) {
          // try to find original snapshot by searching local commits reachable to remote? Use fetched snapshot placeholder
          s.commitFileSnapshots.set(remoteTarget, new Map());
        }
      } else {
        // assume remote commit already in s.commits via initial cloning? keep.
      }
    }
    // Now merge remote tracking into current branch
    const currentBranch = s.head!;
    // Create a temporary branch representing remote?
    const tmpBranch = `__remote_${remoteName}_${branchName}`;
    // Use merge logic: try fast-forward or merge
    this.state = s;
    // Temporarily ensure a branch object for remote tracking to merge from
    const remoteTrackingId = remoteTarget;
    // Check ancestor relation
    const currentTarget = s.branches.get(currentBranch)!.target;
    if (currentTarget && isAncestor(s, currentTarget, remoteTrackingId)) {
      // fast-forward
      s.branches.get(currentBranch)!.target = remoteTrackingId;
      this.restoreWorkingDirToCommit(s, remoteTrackingId);
      this.state = s;
      return { result: { stdout: `Updating ${currentTarget.slice(0, 7)}..${remoteTrackingId.slice(0, 7)}\nFast-forward`, stderr: '', exitCode: 0 }, newState: s };
    }
    if (currentTarget && isAncestor(s, remoteTrackingId, currentTarget)) {
      return { result: { stdout: 'Already up to date.', stderr: '', exitCode: 0 }, newState: s };
    }
    // Need merge commit
    // Simulate fetching remote snapshot if missing
    if (!s.commitFileSnapshots.has(remoteTrackingId)) {
      // Create a fake snapshot with a distinct file
      s.commitFileSnapshots.set(remoteTrackingId, new Map([['remote-feature.txt', 'remote change']]));
    }
    // Use engine merge via creating a temporary branch entry then merging
    s.branches.set(tmpBranch, { name: tmpBranch, target: remoteTrackingId });
    this.state = s;
    const mergeRes = this.handleMerge([tmpBranch], new Map());
    // cleanup temp branch
    const finalState = cloneState(this.state);
    finalState.branches.delete(tmpBranch);
    this.state = finalState;
    return mergeRes;
  }

  private handleClone(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    if (args.length === 0) return { result: { stdout: '', stderr: 'fatal: You must specify a repository to clone.', exitCode: 128 }, newState: this.state };
    const url = args[0];
    if (this.state.initialized) {
      return { result: { stdout: '', stderr: `fatal: destination path '.' already exists and is not an empty directory.`, exitCode: 128 }, newState: this.state };
    }
    const ns = cloneState(this.state);
    ns.initialized = true;
    ns.remotes.set('origin', { name: 'origin', url, branches: new Map(), fetchedCommits: new Map() });
    // Create a default commit and branch as if cloned
    const counter = ns.commitCounter + 1;
    const { id, shortId } = generateCommitId(counter);
    ns.commitCounter = counter;
    const commit: Commit = {
      id,
      shortId,
      message: 'Initial commit',
      parents: [],
      author: 'Origin <origin@example.com>',
      timestamp: Date.now() + counter * 1000,
      branchAtCreation: 'main',
    };
    ns.commits.set(id, commit);
    const snap = new Map<string, string>([['README.md', '# Cloned repo\n']]);
    ns.commitFileSnapshots.set(id, snap);
    ns.branches.set('main', { name: 'main', target: id, upstream: 'origin/main' });
    ns.remotes.get('origin')!.branches.set('main', id);
    ns.remotes.get('origin')!.fetchedCommits.set(id, { ...commit });
    ns.head = 'main';
    ns.detachedCommit = null;
    ns.workingDir.set('README.md', { path: 'README.md', status: 'committed', content: '# Cloned repo\n' });
    this.state = ns;
    return {
      result: { stdout: `Cloning into '.'...\nremote: Enumerating objects: 3, done.\nReceiving objects: 100% (3/3), done.`, stderr: '', exitCode: 0 },
      newState: ns,
    };
  }

  private handleReset(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    const mode = flags.has('hard') ? 'hard' : flags.has('soft') ? 'soft' : flags.has('mixed') ? 'mixed' : 'mixed';
    let target = args[0] ?? 'HEAD';
    // if arg looks like file path and mode? For simplicity treat first arg as commit if it matches branch/commit/head
    let commitId: string | null = null;
    const maybeCommit = this.resolveRef(target);
    if (maybeCommit || target === 'HEAD' || target.startsWith('HEAD~')) {
      commitId = maybeCommit ?? getCurrentCommitId(s);
    } else {
      // maybe `git reset <file>` is actually restore? But we treat as reset file (unstage)
      // For simplicity, if args includes file path that exists, treat as unstaging
      // But spec: git reset [<commit>] [--] [<path>] - we don't support mixed file reset here
      // Fallback to HEAD
      commitId = getCurrentCommitId(s);
    }
    if (!commitId) return { result: { stdout: '', stderr: `fatal: ambiguous argument '${target}': unknown revision`, exitCode: 128 }, newState: this.state };
    // move current branch to target
    if (s.head) {
      const br = s.branches.get(s.head);
      if (br) br.target = commitId;
    } else if (s.detachedCommit) {
      s.detachedCommit = commitId;
    }
    if (mode === 'soft') {
      // keep index and workingDir
    } else if (mode === 'mixed') {
      // reset index to commit snapshot, keep workingDir
      s.index.clear();
      const snap = s.commitFileSnapshots.get(commitId);
      if (snap) {
        for (const [path, file] of s.workingDir) {
          const committedContent = snap.get(path);
          if (committedContent !== undefined) {
            if (file.content !== committedContent) file.status = 'modified';
            else file.status = 'committed';
            file.stagedContent = undefined;
          } else {
            // file not in commit, if it was committed becomes untracked?
            if (file.status === 'staged' || file.status === 'committed') file.status = 'untracked';
          }
        }
      }
    } else if (mode === 'hard') {
      s.index.clear();
      const snap = s.commitFileSnapshots.get(commitId);
      if (snap) {
        // replace workingDir with snapshot
        s.workingDir.clear();
        for (const [p, c] of snap) s.workingDir.set(p, { path: p, status: 'committed', content: c });
      } else {
        s.workingDir.clear();
      }
    }
    this.state = s;
    return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
  }

  private handleRestore(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    const staged = flags.has('staged') || args.includes('--staged');
    const path = args.find((a) => !a.startsWith('-') && a !== '--staged') ?? args[args.length - 1];
    if (!path || path.startsWith('-')) return { result: { stdout: '', stderr: 'error: you must specify path(s) to restore', exitCode: 1 }, newState: this.state };
    const file = s.workingDir.get(path);
    if (!file) return { result: { stdout: '', stderr: `error: pathspec '${path}' did not match any file(s) known to git`, exitCode: 1 }, newState: this.state };
    if (staged) {
      // unstage
      if (file.status === 'staged') {
        const headId = getCurrentCommitId(s);
        const snap = headId ? s.commitFileSnapshots.get(headId) : undefined;
        const headContent = snap?.get(path);
        file.status = headContent !== undefined ? (file.content !== headContent ? 'modified' : 'committed') : 'untracked';
        file.stagedContent = undefined;
        s.index.delete(path);
      }
    } else {
      // discard working changes: restore from index if staged else from HEAD
      const headId = getCurrentCommitId(s);
      const snap = headId ? s.commitFileSnapshots.get(headId) : undefined;
      const headContent = snap?.get(path);
      const stagedContent = file.stagedContent;
      if (stagedContent !== undefined) {
        file.content = stagedContent;
        file.status = 'staged';
      } else if (headContent !== undefined) {
        file.content = headContent;
        file.status = 'committed';
        file.stagedContent = undefined;
        s.index.delete(path);
      } else {
        s.workingDir.delete(path);
        s.index.delete(path);
      }
    }
    this.state = s;
    return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
  }

  private handleStash(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    const sub = args[0];
    if (!sub || sub === 'push' || sub === 'save') {
      // stash push
      const hasChanges = Array.from(s.workingDir.values()).some((f) => f.status !== 'committed');
      if (!hasChanges && s.index.size === 0) return { result: { stdout: 'No local changes to save', stderr: '', exitCode: 0 }, newState: s };
      const entry: typeof s.stash[0] = {
        id: `stash@{${s.stash.length}}`,
        message: args.slice(1).join(' ') || `WIP on ${s.head ?? 'HEAD'}`,
        files: cloneMap(s.workingDir, (f) => ({ ...f })),
        branch: s.head ?? 'HEAD',
        commit: getCurrentCommitId(s),
      };
      s.stash.unshift(entry);
      // reset workingDir to HEAD
      const headId = getCurrentCommitId(s);
      const snap = headId ? s.commitFileSnapshots.get(headId) : undefined;
      s.workingDir.clear();
      if (snap) for (const [p, c] of snap) s.workingDir.set(p, { path: p, status: 'committed', content: c });
      s.index.clear();
      this.state = s;
      return { result: { stdout: `Saved working directory and index state ${entry.message}`, stderr: '', exitCode: 0 }, newState: s };
    }
    if (sub === 'pop' || sub === 'apply') {
      if (s.stash.length === 0) return { result: { stdout: '', stderr: 'No stash entries found.', exitCode: 1 }, newState: this.state };
      const entry = s.stash[0];
      if (sub === 'pop') s.stash.shift();
      // apply files onto workingDir as modified
      for (const [path, file] of entry.files) {
        const current = s.workingDir.get(path);
        if (!current || current.content !== file.content) {
          s.workingDir.set(path, { path, status: 'modified', content: file.content });
        }
      }
      this.state = s;
      return { result: { stdout: `On branch ${s.head}\nChanges restored from ${entry.id}`, stderr: '', exitCode: 0 }, newState: s };
    }
    if (sub === 'list') {
      const lines = s.stash.map((e) => `${e.id}: ${e.message}`);
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
    if (sub === 'clear') {
      s.stash = [];
      this.state = s;
      return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
    }
    return { result: { stdout: '', stderr: `unknown subcommand ${sub}`, exitCode: 1 }, newState: this.state };
  }

  private handleTag(args: string[], flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    if (args.length === 0) {
      const lines = Array.from(s.tags.keys());
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
    // delete
    if (flags.has('d') || args[0] === '-d') {
      const name = args[1] ?? args[0];
      if (!s.tags.has(name)) return { result: { stdout: '', stderr: `error: tag '${name}' not found.`, exitCode: 1 }, newState: this.state };
      s.tags.delete(name);
      this.state = s;
      return { result: { stdout: `Deleted tag '${name}'`, stderr: '', exitCode: 0 }, newState: s };
    }
    const name = args[0];
    const targetRef = args[1] ?? 'HEAD';
    const commitId = this.resolveRef(targetRef) ?? getCurrentCommitId(s);
    if (!commitId) return { result: { stdout: '', stderr: `fatal: Failed to resolve '${targetRef}' as a valid ref.`, exitCode: 128 }, newState: this.state };
    s.tags.set(name, commitId);
    this.state = s;
    return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
  }

  private handleCherryPick(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    if (args.length === 0) return { result: { stdout: '', stderr: 'error: you must specify a commit to cherry-pick', exitCode: 1 }, newState: this.state };
    const s = cloneState(this.state);
    const targetRef = args[0];
    const commitId = this.resolveRef(targetRef);
    if (!commitId) return { result: { stdout: '', stderr: `fatal: bad revision '${targetRef}'`, exitCode: 128 }, newState: this.state };
    const commit = s.commits.get(commitId);
    if (!commit) return { result: { stdout: '', stderr: `fatal: bad object ${commitId}`, exitCode: 128 }, newState: this.state };
    const currentId = getCurrentCommitId(s);
    if (!currentId) return { result: { stdout: '', stderr: 'cannot cherry-pick: no commits', exitCode: 1 }, newState: this.state };
    // Apply changes from commit onto current branch as new commit
    const parentId = commit.parents[0] ?? null;
    const parentSnap = parentId ? s.commitFileSnapshots.get(parentId) : new Map<string, string>();
    const commitSnap = s.commitFileSnapshots.get(commitId) ?? new Map<string, string>();
    const curSnap = s.commitFileSnapshots.get(currentId) ?? new Map<string, string>();
    // Check conflict: if cherry-pick changes file that current branch also changed differently since common ancestor
    const baseSnap = parentSnap ?? new Map<string, string>();
    for (const [path, content] of commitSnap) {
      const base = baseSnap.get(path);
      const curContent = curSnap.get(path);
      if (base !== content && curContent !== undefined && curContent !== base && curContent !== content) {
        s.conflict = { path, currentBranch: s.head ?? 'HEAD', incomingBranch: `cherry-pick ${commit.shortId}`, currentContent: curContent, incomingContent: content };
        const conflictContent = `<<<<<<< HEAD\n${curContent}\n=======\n${content}\n>>>>>>> ${commit.shortId} ${commit.message}\n`;
        const f = s.workingDir.get(path);
        if (f) { f.content = conflictContent; f.status = 'modified'; } else s.workingDir.set(path, { path, status: 'modified', content: conflictContent });
        this.state = s;
        return { result: { stdout: `Auto-merging ${path}\nCONFLICT (content): Merge conflict in ${path}\nerror: could not apply ${commit.shortId}... ${commit.message}`, stderr: '', exitCode: 1 }, newState: s };
      }
    }
    // No conflict, create new commit
    const counter = s.commitCounter + 1;
    const { id, shortId } = generateCommitId(counter);
    s.commitCounter = counter;
    const newCommit: Commit = {
      id,
      shortId,
      message: commit.message,
      parents: [currentId],
      author: commit.author,
      timestamp: Date.now() + counter * 1000,
      branchAtCreation: s.head ?? 'HEAD',
    };
    const newSnap = new Map<string, string>(curSnap);
    for (const [p, c] of commitSnap) {
      const base = baseSnap.get(p);
      if (base !== c) newSnap.set(p, c);
    }
    for (const p of baseSnap.keys()) if (!commitSnap.has(p)) newSnap.delete(p);
    s.commits.set(id, newCommit);
    s.commitFileSnapshots.set(id, newSnap);
    if (s.head) s.branches.get(s.head)!.target = id;
    else s.detachedCommit = id;
    this.restoreWorkingDirToCommit(s, id);
    this.state = s;
    return { result: { stdout: `[${s.head} ${shortId}] ${commit.message}`, stderr: '', exitCode: 0 }, newState: s };
  }

  private handleRevert(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    if (args.length === 0) return { result: { stdout: '', stderr: 'error: you must specify a commit to revert', exitCode: 1 }, newState: this.state };
    const s = cloneState(this.state);
    const targetRef = args[0];
    const commitId = this.resolveRef(targetRef);
    if (!commitId) return { result: { stdout: '', stderr: `fatal: bad revision '${targetRef}'`, exitCode: 128 }, newState: this.state };
    const commit = s.commits.get(commitId);
    if (!commit) return { result: { stdout: '', stderr: `fatal: bad object ${commitId}`, exitCode: 128 }, newState: this.state };
    const currentId = getCurrentCommitId(s);
    if (!currentId) return { result: { stdout: '', stderr: 'no commits to revert', exitCode: 1 }, newState: this.state };
    // Revert = new commit that undoes changes of target commit
    const parentId = commit.parents[0] ?? null;
    const parentSnap = parentId ? s.commitFileSnapshots.get(parentId) : new Map<string, string>();
    const commitSnap = s.commitFileSnapshots.get(commitId) ?? new Map<string, string>();
    const curSnap = s.commitFileSnapshots.get(currentId) ?? new Map<string, string>();
    // For simplicity, revert by applying inverse diff parentSnap->commitSnap onto curSnap
    const newSnap = new Map<string, string>(curSnap);
    for (const [p, content] of parentSnap?.entries() ?? []) {
      const commitContent = commitSnap.get(p);
      if (commitContent !== content) {
        // file changed in commit, revert to parent content
        if (newSnap.get(p) === commitContent || !newSnap.has(p)) newSnap.set(p, content);
      }
    }
    for (const [p, content] of commitSnap.entries()) {
      if (!parentSnap?.has(p)) {
        // file added in commit, delete in revert
        newSnap.delete(p);
      }
    }

    const counter = s.commitCounter + 1;
    const { id, shortId } = generateCommitId(counter);
    s.commitCounter = counter;
    const newCommit: Commit = {
      id,
      shortId,
      message: `Revert "${commit.message}"`,
      parents: [currentId],
      author: s.config.get('user.name') ?? 'You <you@example.com>',
      timestamp: Date.now() + counter * 1000,
      branchAtCreation: s.head ?? 'HEAD',
    };
    s.commits.set(id, newCommit);
    s.commitFileSnapshots.set(id, newSnap);
    if (s.head) s.branches.get(s.head)!.target = id;
    else s.detachedCommit = id;
    this.restoreWorkingDirToCommit(s, id);
    this.state = s;
    return { result: { stdout: `[${s.head} ${shortId}] Revert "${commit.message}"`, stderr: '', exitCode: 0 }, newState: s };
  }

  private handleBlame(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    if (args.length === 0) return { result: { stdout: '', stderr: `fatal: no file given`, exitCode: 128 }, newState: this.state };
    const path = args[0];
    // Walk history to find commits that touched path
    const commits = getLogCommits(this.state, true).reverse();
    const lines: string[] = [];
    const content = this.state.commitFileSnapshots.get(getCurrentCommitId(this.state) ?? '')?.get(path) ?? this.state.workingDir.get(path)?.content ?? '';
    const split = content.split('\n');
    for (let i = 0; i < split.length; i++) {
      // find first commit that has this file content
      let blamed: Commit | undefined;
      for (const c of commits) {
        const snap = this.state.commitFileSnapshots.get(c.id);
        if (snap?.get(path)?.includes(split[i])) { blamed = c; break; }
      }
      const label = blamed ? `${blamed.shortId} (${blamed.author} ${new Date(blamed.timestamp).toISOString().slice(0, 10)})` : 'Not Committed Yet';
      lines.push(`${label} ${i + 1}) ${split[i]}`);
    }
    return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: this.state };
  }

  private handleBisect(_args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    return { result: { stdout: 'bisect: not yet implemented in simulation. Use git log to find bugs.', stderr: '', exitCode: 0 }, newState: this.state };
  }

  private handleConfig(args: string[], _flags: Map<string, string | true>): { result: ExecResult; newState: GitState } {
    const s = cloneState(this.state);
    if (args.length === 0) {
      const lines = Array.from(s.config.entries()).map(([k, v]) => `${k}=${v}`);
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
    // handle --global, --list etc. Simplify: last two args are key value
    let key = '';
    let value = '';
    // filter out --global
    const filtered = args.filter((a) => a !== '--global' && a !== '--list');
    if (filtered.length === 1 && filtered[0] === '--list') {
      const lines = Array.from(s.config.entries()).map(([k, v]) => `${k}=${v}`);
      return { result: { stdout: lines.join('\n'), stderr: '', exitCode: 0 }, newState: s };
    }
    if (filtered.length >= 2) {
      key = filtered[filtered.length - 2];
      value = filtered[filtered.length - 1];
      s.config.set(key, value);
      this.state = s;
      return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
    }
    if (filtered.length === 1) {
      key = filtered[0];
      const v = s.config.get(key);
      if (v !== undefined) return { result: { stdout: v, stderr: '', exitCode: 0 }, newState: s };
      return { result: { stdout: '', stderr: '', exitCode: 1 }, newState: s };
    }
    return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: s };
  }

  private handleConfigLegacy(args: string[], _flags: Map<string, string | true>): void {}
}

function pathSummary(snap: Map<string, string>): string {
  return `${snap.size} file(s) changed`;
}
