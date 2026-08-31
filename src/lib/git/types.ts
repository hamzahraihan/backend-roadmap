export type Commit = {
  id: string;
  shortId: string;
  message: string;
  parents: string[];
  author: string;
  timestamp: number;
  branchAtCreation: string;
};

export type Branch = {
  name: string;
  target: string | null;
  upstream?: string; // e.g. "origin/main"
};

export type Remote = {
  name: string;
  url: string;
  branches: Map<string, string | null>; // remote branch -> commit id
  fetchedCommits: Map<string, Commit>;
};

export type FileStatus = 'untracked' | 'modified' | 'staged' | 'committed' | 'deleted';

export type FileEntry = {
  path: string;
  status: FileStatus;
  content: string;
  stagedContent?: string;
};

export type StashEntry = {
  id: string;
  message: string;
  files: Map<string, FileEntry>;
  branch: string;
  commit: string | null;
};

export type ConflictState = {
  path: string;
  currentBranch: string;
  incomingBranch: string;
  currentContent: string;
  incomingContent: string;
} | null;

export type GitState = {
  initialized: boolean;
  commits: Map<string, Commit>;
  branches: Map<string, Branch>;
  head: string | null; // branch name or null for detached
  detachedCommit: string | null;
  index: Set<string>;
  workingDir: Map<string, FileEntry>;
  remotes: Map<string, Remote>;
  stash: StashEntry[];
  conflict: ConflictState;
  config: Map<string, string>;
  commitCounter: number;
  // for remote tracking simulation
  remoteCommitsAhead: Map<string, number>; // branch -> ahead count
  commitFileSnapshots: Map<string, Map<string, string>>; // commitId -> file snapshots
  tags: Map<string, string>; // tag -> commitId
};

export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CheatGroup = 'Basics' | 'Branches' | 'Commit History' | 'Remote Repositories' | 'Undoing Changes' | 'Advanced Commands';

export type CheatItem = {
  command: string;
  usage: string;
  example: string;
  explanation: string;
  group: CheatGroup;
};

export type PresetObjective = {
  title: string;
  description: string;
  hint: string;
  winCondition: (state: GitState) => boolean;
  winMessage: string;
  allowedCommands?: string[]; // if set, terminal shows hint when blocked (but we don't block, just warn)
};

export type GitPreset = {
  id: string;
  initialState: GitState;
  objective: PresetObjective;
};
