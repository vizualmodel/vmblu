
## create a repo

```bash
# init repo
cd path/to/vmblu

# Initialize git if not done yet
git init

# get rid of CRLF complaints
git config --global core.autocrlf input

# Add all files and commit
git add .
git commit -m "Initial commit"

# Point remote to your organization’s repo
git remote add origin https://github.com/vizualmodel/vmblu.git

# Make sure main branch exists
git branch -M main

# Push to GitHub
git push -u origin main
```
---
## BE CAREFUL - to delete the repo:
```bash
rm -rf .git
```
---
# Git Workflow (vizualmodel/vmblu)

A concise cheat sheet for day-to-day Git with GitHub.

## 0) One-time setup (already done)

```bash
git remote -v               # should show origin https://github.com/vizualmodel/vmblu.git
git config --global pull.rebase true   # cleaner history (optional)
```

---

## 1) Work directly on `main` (solo)

```bash
git status
git add .                               # or add specific paths
git commit -m "Short, imperative summary"
git push
```

---

## 2) Feature branch flow (recommended)

```bash
# create branch off latest main
git checkout main
git pull
git checkout -b feature/<short-name>    # e.g. feature/camera-widgets

# work, then commit
git add .
git commit -m "Implement camera widgets in Page node"

# publish branch
git push -u origin feature/<short-name>

# open a Pull Request on GitHub: feature/<short-name> → main
# after PR is merged, clean up:
git checkout main
git pull
git branch -d feature/<short-name>
git push origin --delete feature/<short-name>
```

---

## 3) Sync your branch with updated `main`

```bash
git checkout feature/<short-name>
git fetch origin
git rebase origin/main    # or: git merge origin/main
# resolve any conflicts, then:
git push --force-with-lease   # only if you rebased
```

---

## 4) Inspect & undo

```bash
git status                                # what changed
git log --oneline --graph --decorate      # history
git diff                                   # unstaged changes
git diff --staged                          # staged changes

git restore -- path/to/file                # discard local changes
git restore --staged path/to/file          # unstage, keep changes
git commit --amend                         # edit last commit message
git reset --soft HEAD~1                    # undo commit, keep staged
git reset --mixed HEAD~1                   # undo commit, keep changes
git reset --hard HEAD~1                    # ⚠️ drop commit & changes
```

---

## 5) Stash (park work temporarily)

```bash
git stash push -m "wip: something"
git stash list
git stash show -p stash@{0}
git stash pop             # re-apply and remove from stash
```

---

## 6) Remove a tracked file and ignore it next time

```bash
git rm --cached path/to/big-or-temp.file
echo "path/to/big-or-temp.file" >> .gitignore
git add .gitignore
git commit -m "Stop tracking big/temp file; update .gitignore"
git push
```

---

## 7) Large assets (EXR/8K textures, etc.)

* Prefer **Git LFS** for files > 50–100 MB:

  ```bash
  git lfs install
  git lfs track "*.exr"
  git add .gitattributes
  git add path/to/your.exr
  git commit -m "Track EXR via Git LFS"
  git push
  ```
* Or exclude big files entirely and download at build time (keep paths in `.gitignore`).

---

## 8) Line endings (Windows/macOS/Linux)

* Keep LF in the repo, let editors handle checkout:

  ```bash
  git config --global core.autocrlf input
  ```
* Enforce via `.gitattributes`:

  ```
  * text=auto eol=lf
  ```

---

## 9) Tags & releases (optional)

```bash
git tag -a v0.1.0 -m "First private test release"
git push origin v0.1.0
# then draft a GitHub Release from the tag if needed
```

---

## 10) Quick FAQs

* **See current remotes**: `git remote -v`
* **Rename branch**: `git branch -m old new && git push origin :old && git push -u origin new`
* **Delete remote branch**: `git push origin --delete branch-name`
* **Update your forked clone** (if you ever fork): add upstream, `git fetch upstream`, rebase/merge.

---

**Tip:** Keep commit messages short & imperative (e.g., “Add X”, “Fix Y”). For bigger changes, write a descriptive PR body.

---

If you want, I can also add a minimal `.gitattributes` and `.gitignore` tuned for your setup (Vite/VSCode/WebView + `zzz-*` patterns) to round this out.
