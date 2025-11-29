# Deployment Guide 🚀

This guide covers how to update the live version of **House Budget** hosted on GitHub Pages.

Because this is a **Progressive Web App (PWA)**, there are two distinct parts to a deployment:
1.  **The Code Push:** Saving your source code to the repository.
2.  **The Build & Deploy:** Compiling the app and updating the live website.

---

## ⚡️ Quick Deploy (The Standard Routine)

Run these commands in your terminal when you are ready to ship changes:

### 1. Save your Source Code
First, ensure your work is saved to the `main` branch.

```bash
# Stage all changes
git add .

# Commit with a description of what you changed
git commit -m "Update: Description of changes here"

# Push source code to GitHub (Safe storage)
git push origin main

# Don't forget to run 'npm run deploy' to update the live website