# Siri Integration Strategy for Personal Budget PWA

**Status:** Planned (Phase 4.3)
**Complexity:** Medium (Code) / High (User Setup)

## Overview
Since we are building a PWA (web app) and not a native iOS app (Swift), we cannot "register" a Siri Intent directly. We must use a **URL Scheme** workaround.

## The Architecture: "The Deep Link Trick"
You cannot just say "Hey Siri, tell MyBudget..." because Apple doesn't let websites talk to Siri directly. Instead, we use the **Apple Shortcuts App** as a bridge.

### The Workflow
1.  **User:** Says "Hey Siri, Add Transaction..."
2.  **Siri:** Asks "What's the text?"
3.  **User:** "Grocery transaction at Walmart for $33.28"
4.  **Shortcuts App:** Takes that text and opens a specific URL:
    `https://your-app.com/add?query=Grocery%20transaction%20at%20Walmart%20for%20$33.28`
5.  **Your App:** Opens, reads the `?query=`, parses it, and pre-fills the "Add Transaction" form.

## Difficulty Assessment

| Component | Difficulty | Why? |
| :--- | :--- | :--- |
| **Siri Integration** | 🟢 Easy | You don't build this. The user creates a standard iOS Shortcut that opens a URL. We can share an iCloud link to this shortcut so they don't have to build it manually. |
| **The "Smart Add" Route** | 🟢 Easy | We just add a `useEffect` in `App.tsx` to check for `?query=` on load. |
| **The NLP Parser** | 🔴 Hard | This is the tricky part. Converting "Walmart for 33.28" into `{ merchant: 'Walmart', amount: 33.28 }` requires smart RegEx or logic. |

## Technical Solution: The "Smart Parser"
We don't need AI. We can use "Senior Engineer" Regular Expressions.

### The Logic
1.  **Find Amount:** Look for `$` or decimal numbers.
    * Regex: `/\$?\d+\.\d{2}/`
    * Result: `$33.28` -> `33.28`
2.  **Find Envelope:** Compare words against your local `envelopes` list.
    * Input: "Grocery transaction..."
    * Logic: Does "Grocery" match any envelope name?
    * Match: Found "Groceries" envelope!
3.  **Find Merchant:** Everything else is the Merchant/Description.

## Implementation Plan (Roadmap Phase 4.3)

### Option A: Regex-Based Parser (Original)
1.  **Create a `/add` route:**
    * This route accepts a `?q=` parameter.
2.  **Build the `SmartTransactionParser`:**
    * A utility function that takes a string and returns a `Partial<Transaction>` object.
3.  **The User Experience:**
    * When the app opens via this link, it goes straight to the "Add Transaction" modal with everything pre-filled.
    * The user just hits "Save".

### Option B: Firebase + Google AI Integration (Recommended)
**Complexity:** Low (Code) / Medium (Setup)

#### Architecture
1. **Firebase Cloud Function**: `parseTransaction`
   - Accepts text and user's envelope list
   - Calls Google Gemini API for parsing
   - Returns structured transaction data

2. **Frontend Integration**:
   - Modified `/add-transaction` route with `?query=` parameter
   - Cloud Function call from `App.tsx`
   - Fallback to regex if AI fails

#### Benefits
- **Handles ambiguity**: AI understands context and variations
- **Flexible input**: Any phrasing works naturally
- **Multi-language support**: Works beyond English
- **Learns patterns**: Can improve with prompt engineering
- **Cost-effective**: ~$0.01 per 100 Siri transactions

#### Implementation Steps
1. **Set up Firebase Cloud Functions**
2. **Integrate Gemini API** in Cloud Function
3. **Add security rules** for rate limiting and access control
4. **Update frontend** to call Cloud Function
5. **Implement fallback** to regex-based parsing
6. **Add error handling** for AI failures

#### Code Example
```typescript
// Cloud Function: parseTransaction
export const parseTransaction = functions.https.onCall(async (data, context) => {
  const { text, userEnvelopes } = data;
  
  const response = await gemini.generateContent({
    contents: [{
      role: "user",
      parts: [{
        text: `Parse this transaction: "${text}"
        
        Available envelopes: ${userEnvelopes.join(', ')}
        
        Return JSON with: merchant, amount, envelope, description`
      }]
    }]
  });
  
  return JSON.parse(response.response.text());
});
```

#### Cost & Privacy
- **Gemini API**: ~$0.00025 per 1K tokens
- **Cloud Functions**: $0.40 per million invocations
- **Privacy**: User data processed in Google's infrastructure
- **Security**: Firebase authentication and security rules

### Recommended Approach
**Start with Option B** - The AI integration solves the core NLP challenges while keeping your PWA lightweight. The Cloud Function handles heavy lifting, and your app remains fast and responsive.