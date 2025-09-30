
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