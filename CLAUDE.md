# Personal Budget PWA

## Quick Commands

### "ship it"
Version patch + commit + push + deploy to gh-pages. Steps:
1. `npm version patch --no-git-tag-version`
2. Stage changed files, commit with version prefix (e.g. `v1.17.7 - description`)
3. `git push`
4. `npm run deploy`

### "dev server" / "spin it up"
Start dev server on port 3003: `npx vite --port 3003`

## Project Notes

- Deployed via gh-pages to GitHub Pages
- Dev server runs on **port 3003**
- Commit messages follow pattern: `vX.Y.Z - Short description`
