import type { CheatItem } from './types';

export const CHEAT_SHEET: CheatItem[] = [
  // Basics
  { command: 'git init', usage: 'git init', example: 'git init', explanation: 'Creates a new Git repository. Initializes a hidden .git directory with all metadata.', group: 'Basics' },
  { command: 'git status', usage: 'git status', example: 'git status', explanation: 'Shows working tree status — which files are staged, modified, or untracked.', group: 'Basics' },
  { command: 'git add', usage: 'git add <file> or git add .', example: 'git add index.html', explanation: 'Adds file contents to the staging area (index) for the next commit. Use `git add .` for all changes.', group: 'Basics' },
  { command: 'git commit', usage: 'git commit -m "<message>"', example: 'git commit -m "Fix bug in login form"', explanation: 'Records staged changes as a new commit with a message describing the change.', group: 'Basics' },
  { command: 'git config', usage: 'git config [--global] <key> <value>', example: 'git config user.name "Your Name"', explanation: 'Sets configuration values for user name, email, and other preferences.', group: 'Basics' },
  { command: 'git help', usage: 'git help <command>', example: 'git help commit', explanation: 'Displays help information for any Git command. Also `git <command> --help`.', group: 'Basics' },
  // Branches
  { command: 'git branch', usage: 'git branch [name] [--delete]', example: 'git branch feature-login', explanation: 'Lists, creates, or deletes branches. Without args it lists local branches.', group: 'Branches' },
  { command: 'git checkout', usage: 'git checkout <branch> or git checkout -b <new-branch>', example: 'git checkout -b feature-login', explanation: 'Switches branches. With -b, creates and switches in one step.', group: 'Branches' },
  { command: 'git switch', usage: 'git switch <branch> or git switch -c <new-branch>', example: 'git switch main', explanation: 'Modern alternative to checkout for switching branches. Use -c to create.', group: 'Branches' },
  { command: 'git merge', usage: 'git merge <branch>', example: 'git merge feature-login', explanation: 'Integrates changes from the specified branch. Creates a merge commit when not fast-forward.', group: 'Branches' },
  { command: 'git branch -d', usage: 'git branch -d <branch>', example: 'git branch -d feature-login', explanation: 'Deletes a branch if merged. Use -D to force deletion.', group: 'Branches' },
  // Commit History
  { command: 'git log', usage: 'git log [options]', example: 'git log --oneline --graph', explanation: 'Shows commit history with author, date, and message. Supports many format options.', group: 'Commit History' },
  { command: 'git diff', usage: 'git diff [<commit>] [<commit>]', example: 'git diff HEAD~1 HEAD', explanation: 'Shows differences between commits or between working tree and index.', group: 'Commit History' },
  { command: 'git show', usage: 'git show [<commit>]', example: 'git show HEAD', explanation: 'Shows information about a Git object. For commits, shows message and diff.', group: 'Commit History' },
  { command: 'git blame', usage: 'git blame <file>', example: 'git blame index.html', explanation: 'Shows who changed each line of a file and in which commit.', group: 'Commit History' },
  // Remote Repositories
  { command: 'git clone', usage: 'git clone <url>', example: 'git clone https://github.com/user/repo.git', explanation: 'Creates a local copy of a remote repository including all branches and history.', group: 'Remote Repositories' },
  { command: 'git pull', usage: 'git pull [remote] [branch]', example: 'git pull origin main', explanation: 'Fetches and merges changes from a remote branch (fetch + merge).', group: 'Remote Repositories' },
  { command: 'git push', usage: 'git push [remote] [branch]', example: 'git push origin main', explanation: 'Sends local commits to a remote repository.', group: 'Remote Repositories' },
  { command: 'git remote', usage: 'git remote add <name> <url>', example: 'git remote add origin https://github.com/user/repo.git', explanation: 'Manages remote repositories. Use -v to see URLs.', group: 'Remote Repositories' },
  { command: 'git fetch', usage: 'git fetch [remote]', example: 'git fetch origin', explanation: 'Downloads branches and commits from a remote without merging.', group: 'Remote Repositories' },
  // Undoing Changes
  { command: 'git restore', usage: 'git restore <file> or git restore --staged <file>', example: 'git restore --staged index.html', explanation: 'Restores working tree files or unstages them with --staged.', group: 'Undoing Changes' },
  { command: 'git reset', usage: 'git reset [--soft | --mixed | --hard] [commit]', example: 'git reset --hard HEAD~1', explanation: 'Resets current branch to a commit. --soft keeps index, --mixed unstages, --hard discards all.', group: 'Undoing Changes' },
  { command: 'git revert', usage: 'git revert <commit>', example: 'git revert HEAD', explanation: 'Creates a new commit that undoes an earlier commit. Safe for shared branches.', group: 'Undoing Changes' },
  // Advanced Commands
  { command: 'git rebase', usage: 'git rebase <base>', example: 'git rebase main', explanation: 'Reapplies commits on top of another base branch for a linear history.', group: 'Advanced Commands' },
  { command: 'git stash', usage: 'git stash [pop]', example: 'git stash', explanation: 'Stashes uncommitted changes temporarily. Use `git stash pop` to reapply.', group: 'Advanced Commands' },
  { command: 'git tag', usage: 'git tag [name] [commit]', example: 'git tag v1.0.0', explanation: 'Creates a reference to a specific point in history, used for releases.', group: 'Advanced Commands' },
  { command: 'git cherry-pick', usage: 'git cherry-pick <commit>', example: 'git cherry-pick abc123', explanation: 'Applies changes from specific commits to current branch.', group: 'Advanced Commands' },
  { command: 'git bisect', usage: 'git bisect <subcommand>', example: 'git bisect start', explanation: 'Finds the commit that introduced a bug via binary search.', group: 'Advanced Commands' },
];

export const GROUP_ORDER: CheatItem['group'][] = ['Basics', 'Branches', 'Commit History', 'Remote Repositories', 'Undoing Changes', 'Advanced Commands'];
