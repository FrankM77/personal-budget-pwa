param (
    [Parameter(Mandatory=$false)]
    [string]$Message
)

# 1. Add all changes
Write-Host "📦 Staging all changes..."
git add .

# 2. Check for Commit Message
# If you didn't provide a message in the command, we try to ask for one.
if ([string]::IsNullOrWhiteSpace($Message)) {
    # We force the script to wait a tiny bit to clear any 'ghost' Enter key presses
    Start-Sleep -Milliseconds 500 
    $Message = Read-Host "📝 Enter your commit message"
}

# Double check: Is it still empty?
if ([string]::IsNullOrWhiteSpace($Message)) {
    Write-Host "❌ Error: Commit message cannot be empty." -ForegroundColor Red
    exit 1
}

# 3. Commit
Write-Host "💾 Committing with message: '$Message'..."
git commit -m $Message

# 4. Push
Write-Host "🚀 Pushing to GitHub..."
git push

Write-Host "✅ Done! Code is safely on GitHub." -ForegroundColor Green