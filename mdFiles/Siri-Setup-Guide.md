# Siri Integration Setup Guide

**Status:** ✅ Working (v1.8.8+)  
**Time to Setup:** ~5 minutes  
**Requirements:** iPhone with iOS 13+ and the Personal Budget PWA installed

---

## Overview

Add transactions to your budget using just your voice! Say "Hey Siri, Add Transaction" and speak naturally like "Grocery transaction at Walmart for $33.28 with Chase Amazon" — the app will automatically parse and pre-fill all the fields.

**What it can do:**
- Extract amounts, merchants, envelopes, and payment methods
- Match envelope names (e.g., "grocery" → "Groceries")
- Detect income vs expense transactions
- Pre-fill the Add Transaction form with high accuracy

---

## Step 1: Generate Your Siri Token

1. Open the **Personal Budget PWA**
2. Go to **Settings** → **Siri Integration**
3. Tap **"Generate Siri Token"** (or **Regenerate** if replacing an existing token)
4. **Copy the token** — it looks like `a1b2c3d4e5f6g7h8`

> **Note:** This token is a secret key that protects your account. Keep it private and only use it in your Siri Shortcut.

---

## Step 2: Create the Siri Shortcut

### Method A: Import Pre-built Shortcut (Easiest)

1. Open this link on your iPhone: [Siri Shortcut Link](https://www.icloud.com/shortcuts/[placeholder])
2. Tap **"Add Shortcut"**
3. In the shortcut, tap the **three dots** → **Edit**
4. Find the step with your token and replace `YOUR_TOKEN_HERE` with your actual token
5. Tap **Done**

### Method B: Create Manually (Full Control)

1. Open the **Shortcuts** app on your iPhone
2. Tap **"+"** to create a new shortcut
3. Add these actions in order:

#### Action 1: Ask for Text
- **Action:** "Ask for Text"
- **Prompt:** "What's the transaction?"
- **Input:** None (leave blank)

#### Action 2: URL
- **Action:** "URL"
- **URL:** `https://us-central1-personal-budget-pwa-5defb.cloudfunctions.net/siriStoreQuery?query=[Ask for Text]&token=[PASTE_YOUR_TOKEN_HERE]`
- **Important:** Insert the variables as blue/orange pills, not literal text

#### Action 3: Get Contents of URL
- **Action:** "Get Contents of URL"
- **URL:** Use the output from Action 2 (the URL action)

#### Action 4: Wait
- **Action:** "Wait"
- **Duration:** 3 seconds

#### Action 5: URL
- **Action:** "URL"
- **URL:** `webapp://frankm77.github.io/personal-budget-pwa/`

#### Action 6: Open URL
- **Action:** "Open URL"
- **URL:** Use the output from Action 5

4. **Name your shortcut:** "Add Transaction"
5. Tap **Done**

---

## Step 3: Test It

Try these examples:

### Simple Expense
> "Hey Siri, Add Transaction"  
> "Spent $45 at Target for groceries"

### Detailed Transaction
> "Hey Siri, Add Transaction"  
> "Grocery transaction at Walmart for $33.28 with Chase Amazon"

### Income
> "Hey Siri, Add Transaction"  
> "Got paid $2500 paycheck"

### Quick Entry
> "Hey Siri, Add Transaction"  
> "$12.50 Starbucks coffee"

---

## Step 4: Daily Use

1. Say **"Hey Siri, Add Transaction"**
2. Speak your transaction naturally
3. The PWA opens with a **purple Siri banner** showing parsed data
4. Review the pre-filled form
5. Tap **"Save Transaction"**

The purple banner shows:
- Your original voice input
- Parsed merchant, amount, envelope, and payment method
- Confidence score (how sure the AI is about the parsing)
- **"Clear pre-filled data"** button if you want to start over

---

## Troubleshooting

### "Nothing happens when I use Siri"
- Ensure your PWA is installed: Open in Safari → Share → "Add to Home Screen"
- Check your Shortcut has the correct token (no extra spaces)
- Make sure you're connected to the internet

### "Wrong envelope selected"
- The AI tries to match envelope names. Use exact names like "Groceries" not "grocery"
- You can always correct the envelope before saving

### "Payment method not detected"
- Say phrases like "with Chase Amazon" or "using Venmo"
- The app matches against your saved payment methods in Settings

### "Need to regenerate token"
- Go to Settings → Siri Integration → Tap the **recycle icon** to regenerate
- Update your Shortcut with the new token

---

## Privacy & Security

- Your voice input is processed by Google's Gemini AI for parsing
- Tokens are stored securely in your account settings
- Each user gets a unique, revocable token
- No voice data is permanently stored

---

## Advanced Tips

### Best Voice Commands

| What you want to say | Best phrase | Example |
|---|---|---|
| **Simple expense** | "[Amount] at [Merchant] for [Envelope]" | "$45 at Target for groceries" |
| **With payment method** | "...with [Payment Method]" | "...with Chase Amazon" |
| **Income** | "Got paid [Amount] [Source]" | "Got paid $2500 paycheck" |
| **Quick entry** | "[Amount] [Merchant] [Item]" | "$12.50 Starbucks coffee" |

### Envelope Name Matching

The AI is smart about variations:
- "Grocery" or "Groceries" → "Groceries"
- "Restaurant" or "Restaurants" → "Restaurants"
- "Gas" → "Gas"
- "Gym" → "Gym Membership"

### Multiple Payment Methods

If you have multiple cards/accounts, be specific:
- "...with Chase Amazon" (matches "Chase Amazon")
- "...using Venmo" (matches "Venmo")
- "...on my debit card" (matches your default debit)

---

## Need Help?

If you run into issues:

1. **Check your token** in Settings → Siri Integration
2. **Verify your Shortcut** has the correct URL and token
3. **Ensure PWA is installed** from Safari (not just bookmarked)
4. **Try a simple test** like "$5 coffee" first

Still having problems? The app shows detailed error messages in the purple Siri banner to help you debug.

---

**Enjoy adding transactions with just your voice! 🎤**
