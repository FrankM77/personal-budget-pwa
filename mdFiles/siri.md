# Siri Integration Strategy for Personal Budget PWA

**Status:** ✅ Complete (v1.7.0) - Both Frontend & Backend Deployed
**Complexity:** Medium (Code) / High (User Setup)

---

## Overview
Since we are building a PWA (web app) and not a native iOS app (Swift), we cannot "register" a Siri Intent directly. We use a **URL Scheme** workaround via the Apple Shortcuts App.

## The Architecture: "The Deep Link Trick"

### The Workflow
1.  **User:** Says "Hey Siri, Add Transaction..."
2.  **Siri:** Asks "What's the text?"
3.  **User:** "Grocery transaction at Walmart for $33.28 with Chase Amazon"
4.  **Shortcuts App:** Takes that text and opens a specific URL:
    `https://frankm77.github.io/personal-budget-pwa/#/add-transaction?query=Grocery%20transaction%20at%20Walmart%20for%20$33.28%20with%20Chase%20Amazon`
5.  **Your App:** Opens, reads the `?query=`, parses it via AI (with regex fallback), and pre-fills the "Add Transaction" form.
6.  **User:** Reviews pre-filled form and hits "Save".

---

## Implementation Status

### ✅ Frontend (Complete)

| File | Purpose |
| :--- | :--- |
| `src/utils/smartTransactionParser.ts` | Regex-based NLP parser (fallback) — extracts amount, merchant, envelope, payment method, and transaction type from natural language |
| `src/services/SiriService.ts` | Service layer — calls Firebase Cloud Function for AI parsing, falls back to regex parser if offline or on failure |
| `src/hooks/useSiriQuery.ts` | React hook — detects `?query=` URL parameter, triggers parsing, returns pre-filled data |
| `src/views/AddTransactionView.tsx` | Updated — consumes parsed data to pre-fill amount, merchant, note, type, envelope, and payment method |
| `src/components/SplitTransactionHelper.tsx` | Updated — accepts `initialSelectedEnvelopeId` prop for Siri auto-selection |

#### How It Works (Frontend Flow)
1. User navigates to `/#/add-transaction?query=...`
2. `useSiriQuery` hook detects the `?query=` param
3. If online: calls `SiriService.parseWithAI()` → Firebase Cloud Function
4. If offline or AI fails: falls back to `smartTransactionParser.parseTransactionText()`
5. Parsed result pre-fills: amount, merchant, note, transaction type, envelope, payment method
6. Purple "Siri Shortcut" banner shows the original query and confidence score
7. User reviews and saves

#### Regex Fallback Parser Capabilities
- Extracts dollar amounts: `$33.28`, `33.28`, `33 dollars`
- Fuzzy-matches envelope names: "grocery" → "Groceries" envelope
- Extracts payment methods: "with Chase Amazon", "using Venmo"
- Detects income vs expense: "paycheck", "income", "refund" → Income type
- Extracts merchant from remaining text after amount/envelope/payment extraction
- Returns confidence score (0-1) based on how many fields were matched

### ✅ Backend (Complete — Deployed)

The Firebase Cloud Function `parseTransaction` has been deployed with Gemini AI integration. This provides superior parsing compared to the regex fallback.

---

## Backend Setup (Completed)

### Step 1: Initialize Firebase Functions

```bash
# From the project root
npm install -g firebase-tools
firebase login
firebase init functions
```

Choose:
- **Language:** TypeScript
- **ESLint:** Yes
- **Install dependencies:** Yes

This creates a `functions/` directory.

### Step 2: Install Dependencies

```bash
cd functions
npm install @google-cloud/vertexai
```

### Step 3: Create the Cloud Function

Create `functions/src/index.ts`:

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GCLOUD_PROJECT || 'your-project-id',
  location: 'us-central1',
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

export const parseTransaction = onCall(async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in to parse transactions.');
  }

  const { text, userEnvelopes } = request.data;

  if (!text || typeof text !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid "text" field.');
  }

  if (!userEnvelopes || !Array.isArray(userEnvelopes)) {
    throw new HttpsError('invalid-argument', 'Missing or invalid "userEnvelopes" field.');
  }

  try {
    const prompt = `You are a transaction parser for a budgeting app. Parse the following natural language input into structured transaction data.

Input: "${text}"

Available budget envelopes: ${userEnvelopes.join(', ')}

Return ONLY a valid JSON object with these fields:
- "merchant": string or null (the store/vendor name)
- "amount": number or null (the dollar amount)
- "envelope": string or null (must be one of the available envelopes above, or null if no match)
- "description": string or null (a brief description of the transaction)
- "paymentMethodName": string or null (the payment method name, e.g. "Chase Amazon"; often comes after phrases like "with <payment method>" or "using <payment method>")
- "type": "Income" or "Expense" (default to "Expense" unless the input clearly indicates income like "paycheck", "salary", "refund", etc.)

Examples:
- "Grocery transaction at Walmart for $33.28" → {"merchant":"Walmart","amount":33.28,"envelope":"Groceries","description":"Grocery transaction at Walmart","paymentMethodName":null,"type":"Expense"}
- "Grocery transaction at Walmart for $33.28 using Chase Amazon" → {"merchant":"Walmart","amount":33.28,"envelope":"Groceries","description":"Grocery transaction at Walmart","paymentMethodName":"Chase Amazon","type":"Expense"}
- "Grocery transaction at Walmart for $33.28 with Chase Amazon" → {"merchant":"Walmart","amount":33.28,"envelope":"Groceries","description":"Grocery transaction at Walmart","paymentMethodName":"Chase Amazon","type":"Expense"}
- "Got paid 2500 paycheck" → {"merchant":null,"amount":2500,"envelope":null,"description":"Paycheck","type":"Income"}

Respond with ONLY the JSON object, no markdown, no explanation.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Empty response from Gemini');
    }

    // Clean up response (remove markdown code fences if present)
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      merchant: parsed.merchant || null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      envelope: parsed.envelope || null,
      description: parsed.description || null,
      type: parsed.type === 'Income' ? 'Income' : 'Expense',
    };
  } catch (error: any) {
    console.error('parseTransaction error:', error);
    throw new HttpsError('internal', 'Failed to parse transaction: ' + error.message);
  }
});
```

### Step 4: Configure Firebase Project

```bash
# Set the Google Cloud project (same as your Firebase project)
firebase use your-project-id

# Enable the Vertex AI API in Google Cloud Console:
# https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
```

### Step 5: Deploy the Cloud Function

```bash
firebase deploy --only functions
```

### Step 6: Verify

Test the function by navigating to:
```
https://frankm77.github.io/personal-budget-pwa/#/add-transaction?query=Spent%2045%20at%20Target%20for%20groceries
```

### Step 7: Create the Apple Shortcut (Complete)

Create an iOS Shortcut with these actions:
1. **Ask for Input** → "What's the transaction?" (type: Text)
2. **URL** → `https://frankm77.github.io/personal-budget-pwa/#/add-transaction?query=[Ask for Input]`
3. **Open URLs**

Name it "Add Transaction" so the user can say: **"Hey Siri, Add Transaction"**

**Note:** iOS may open the URL in Safari instead of the installed PWA. This is a known limitation of iOS PWA deep linking. The functionality works perfectly—only the app container behavior varies.

Optionally, share via iCloud link so users can install with one tap.

---

## Security & Rate Limiting

### Firebase Security Rules
The Cloud Function requires authentication (`request.auth` check). Only logged-in users can call it.

### Rate Limiting (Recommended)
Add rate limiting in the Cloud Function to prevent abuse:
```typescript
// Simple in-memory rate limit (for production, use Redis or Firestore)
const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(userId) || [];
  const recentRequests = requests.filter(t => now - t < 60000);
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) return false;
  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
  return true;
}
```

---

## Cost Estimate

| Component | Cost | Notes |
| :--- | :--- | :--- |
| **Gemini API (Vertex AI)** | ~$0.00025 per 1K tokens | Each parse uses ~200 tokens |
| **Cloud Functions** | $0.40 per million invocations | Free tier: 2M invocations/month |
| **Estimated monthly cost** | ~$0.05 for 100 transactions/month | Effectively free for personal use |

---

## Testing

### Test URLs (use after backend is deployed)

```
# Basic expense
/#/add-transaction?query=Spent%2045%20at%20Target%20for%20groceries

# With dollar sign
/#/add-transaction?query=Grocery%20transaction%20at%20Walmart%20for%20%2433.28

# Income
/#/add-transaction?query=Got%20paid%202500%20paycheck

# Simple
/#/add-transaction?query=%2412.50%20Starbucks%20coffee
```

### Regex Fallback (works immediately, no backend needed)
The regex parser works right now for testing the frontend flow. It handles common patterns but won't be as flexible as the AI parser for ambiguous input.