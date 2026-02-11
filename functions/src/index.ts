import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { VertexAI } from '@google-cloud/vertexai';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

// Rate limiting: Track calls per user per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const RATE_LIMIT_MAX_CALLS = 30; // Max 30 calls per minute per user

async function checkRateLimit(userId: string): Promise<void> {
  const db = getFirestore();
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  // Clean up old entries and count recent calls
  const callsRef = db.collection('rateLimits').doc(userId);
  const doc = await callsRef.get();
  
  if (!doc.exists) {
    // First call - initialize
    await callsRef.set({
      calls: [{ timestamp: now }],
      lastReset: now
    });
    return;
  }
  
  const data = doc.data();
  if (!data) {
    // First call - initialize
    await callsRef.set({
      calls: [{ timestamp: now }],
      lastReset: now
    });
    return;
  }
  
  const recentCalls = (data.calls || []).filter((call: any) => 
    call.timestamp > windowStart
  );
  
  if (recentCalls.length >= RATE_LIMIT_MAX_CALLS) {
    throw new HttpsError('resource-exhausted', 
      `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_CALLS} calls per minute. Please try again later.`);
  }
  
  // Add current call and clean up old ones
  recentCalls.push({ timestamp: now });
  await callsRef.update({
    calls: recentCalls,
    lastReset: now
  });
}

const vertexAI = new VertexAI({
  project: process.env.GCLOUD_PROJECT || 'your-project-id',
  location: 'us-central1',
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.0-flash-001',
});

/**
 * HTTP endpoint for Siri Shortcuts to store a transaction query.
 * Called via "Get Contents of URL" action (no auth required).
 * Stores the query in Firestore with a device token for the PWA to retrieve.
 */
export const siriStoreQuery = onRequest({ cors: true }, async (req, res) => {
  console.log('siriStoreQuery called:', req.method, JSON.stringify(req.query), JSON.stringify(req.body));

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const query = req.query.query as string || (req.body && req.body.query);
  const deviceToken = req.query.token as string || (req.body && req.body.token);

  if (!query || !deviceToken) {
    console.log('Missing params. query:', query, 'token:', deviceToken);
    res.status(400).json({ error: 'Missing query or token parameter', receivedQuery: !!query, receivedToken: !!deviceToken });
    return;
  }

  if (query.length > 500) {
    res.status(400).json({ error: 'Query too long' });
    return;
  }

  try {
    const db = getFirestore();
    await db.collection('siriQueries').doc(deviceToken).set({
      query: query,
      timestamp: Date.now(),
      consumed: false,
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('siriStoreQuery error:', error);
    res.status(500).json({ error: 'Failed to store query' });
  }
});

export const parseTransaction = onCall(
  {
    enforceAppCheck: true, // Reject requests with missing or invalid App Check tokens.
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to parse transactions.');
    }

    // Check rate limiting
    await checkRateLimit(request.auth.uid);

    const { text, userEnvelopes } = request.data;

    if (!text || typeof text !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing or invalid "text" field.');
    }

    if (text.length > 500) {
      throw new HttpsError('invalid-argument', 'Text input too long. Maximum 500 characters allowed.');
    }

    if (!userEnvelopes || !Array.isArray(userEnvelopes)) {
      throw new HttpsError('invalid-argument', 'Missing or invalid "userEnvelopes" field.');
    }

    try {
      const prompt = `You are a transaction parser for a budgeting app. Parse the following natural language input into structured transaction data.

Input: "${text}"

Available budget envelopes: ${userEnvelopes.join(', ')}

IMPORTANT: Match envelope names using fuzzy matching. Consider common variations like singular/plural forms, abbreviations, and synonyms. For example:
- "Grocery" or "Groceries" should match an envelope named "Groceries"
- "Restaurant" or "Restaurants" should match an envelope named "Restaurants"
- "Gas" should match "Gas Station" or "Fuel"
- "Gym" should match "Gym Membership"

Use the available envelopes list above and choose the closest match. If no envelope matches well, return null for the envelope field.

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
      paymentMethodName: parsed.paymentMethodName || null,
      type: parsed.type === 'Income' ? 'Income' : 'Expense',
    };
  } catch (error: any) {
    console.error('parseTransaction error:', error);
    throw new HttpsError('internal', 'Failed to parse transaction: ' + error.message);
  }
});