import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { VertexAI } from '@google-cloud/vertexai';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

// Rate limiting: Track calls per user per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const RATE_LIMIT_MAX_CALLS = 30; // Max 30 calls per minute per user

// Investigate users function
export const investigateUsers = onRequest(async (req, res) => {
  try {
    console.log('🔍 Investigating user IDs in Firebase...\n');
    
    const db = getFirestore();
    const auth = require('firebase-admin/auth');
    
    // 1. Check Firebase Authentication users
    console.log('📋 Checking Firebase Authentication users...');
    let authUsers: any[] = [];
    try {
      const listUsersResult = await auth.getAuth().listUsers(1000); // Get up to 1000 users
      authUsers = listUsersResult.users.map((user: any) => ({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
        providerData: user.providerData.map((p: any) => ({ providerId: p.providerId, uid: p.uid, displayName: p.displayName }))
      }));
      console.log(`  Found ${authUsers.length} users in Firebase Authentication`);
    } catch (authError: any) {
      console.log('  ❌ Could not access Firebase Authentication:', authError.message);
    }
    
    // 2. Check Firestore users collection
    console.log('\n📊 Checking Firestore users collection...');
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`  Found ${usersSnapshot.size} user documents in Firestore`);
    
    const firestoreUsers: any[] = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Check subcollections for this user
      const subcollections = ['envelopes', 'transactions', 'categories', 'monthlyBudgets', 'envelopeAllocations', 'appSettings', 'distributionTemplates'];
      let totalDocuments = 0;
      let hasData = false;
      const collectionCounts: Record<string, number> = {};
      
      for (const subcollectionName of subcollections) {
        try {
          const subcollectionRef = db.collection('users').doc(userId).collection(subcollectionName);
          const subcollectionSnapshot = await subcollectionRef.get();
          totalDocuments += subcollectionSnapshot.size;
          collectionCounts[subcollectionName] = subcollectionSnapshot.size;
          if (subcollectionSnapshot.size > 0) hasData = true;
        } catch (error) {
          collectionCounts[subcollectionName] = 0;
        }
      }
      
      firestoreUsers.push({
        userId,
        totalDocuments,
        hasData,
        isEmpty: totalDocuments === 0,
        collectionCounts
      });
      
      console.log(`  ${userId}: ${totalDocuments} total documents ${hasData ? '(has data)' : '(empty)'}`);
      if (totalDocuments > 0) {
        console.log(`    Details:`, collectionCounts);
      }
    }
    
    // 3. Compare and analyze
    console.log('\n🔍 Analysis:');
    
    const authUserIds = new Set(authUsers.map((u: any) => u.uid));
    const firestoreUserIds = new Set(firestoreUsers.map((u: any) => u.userId));
    
    const usersInAuthOnly = [...authUserIds].filter((uid: string) => !firestoreUserIds.has(uid));
    const usersInFirestoreOnly = [...firestoreUserIds].filter((uid: string) => !authUserIds.has(uid));
    const usersInBoth = [...authUserIds].filter((uid: string) => firestoreUserIds.has(uid));
    
    console.log(`  Users in Auth only: ${usersInAuthOnly.length}`);
    console.log(`  Users in Firestore only: ${usersInFirestoreOnly.length}`);
    console.log(`  Users in both: ${usersInBoth.length}`);
    
    const analysis = {
      authUsers: {
        total: authUsers.length,
        users: authUsers
      },
      firestoreUsers: {
        total: firestoreUsers.length,
        usersWithData: firestoreUsers.filter((u: any) => u.hasData).length,
        emptyUsers: firestoreUsers.filter((u: any) => u.isEmpty).length,
        users: firestoreUsers
      },
      comparison: {
        usersInAuthOnly,
        usersInFirestoreOnly,
        usersInBoth
      }
    };
    
    // 4. Identify potential issues
    if (usersInAuthOnly.length > 0) {
      console.log('\n⚠️  Users in Auth but not in Firestore:');
      usersInAuthOnly.forEach((uid: string) => {
        const authUser = authUsers.find((u: any) => u.uid === uid);
        console.log(`  - ${uid} (${authUser?.email || 'no email'}) - Signed up but never created data`);
      });
    }
    
    if (usersInFirestoreOnly.length > 0) {
      console.log('\n⚠️  Users in Firestore but not in Auth:');
      usersInFirestoreOnly.forEach((uid: string) => {
        const firestoreUser = firestoreUsers.find((u: any) => u.userId === uid);
        console.log(`  - ${uid} (${firestoreUser?.totalDocuments || 0} docs) - Orphaned data, user may have been deleted`);
      });
    }
    
    const emptyFirestoreUsers = firestoreUsers.filter((u: any) => u.isEmpty);
    if (emptyFirestoreUsers.length > 0) {
      console.log('\n🗑️  Empty Firestore users (candidates for cleanup):');
      emptyFirestoreUsers.forEach((user: any) => {
        console.log(`  - ${user.userId}`);
      });
    }
    
    res.status(200).json({
      message: 'Investigation complete',
      analysis
    });
    
  } catch (error) {
    console.error('❌ Error investigating user IDs:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Safe cleanup function - removes unused users but protects specified accounts
export const safeCleanupUsers = onRequest(async (req, res) => {
  try {
    console.log('🧹 Starting safe user cleanup...\n');
    
    const db = getFirestore();
    const auth = require('firebase-admin/auth');
    
    // PROTECTED ACCOUNTS - NEVER DELETE THESE
    const PROTECTED_EMAILS = ['frankmarchese01@gmail.com'];
    const PROTECTED_UIDS = ['loGJ7nYvnyUxEI6mgYwYskdE0493']; // UID for frankmarchese01@gmail.com
    
    // 1. Get all Firebase Auth users
    console.log('📋 Getting all Firebase Authentication users...');
    const listUsersResult = await auth.getAuth().listUsers(1000);
    const allUsers = listUsersResult.users;
    
    console.log(`  Found ${allUsers.length} total users in Authentication`);
    
    // 2. Categorize users
    const protectedUsers = [];
    const candidatesForDeletion = [];
    const recentlyActive = [];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const user of allUsers) {
      const isProtectedEmail = PROTECTED_EMAILS.includes(user.email);
      const isProtectedUid = PROTECTED_UIDS.includes(user.uid);
      const isProtected = isProtectedEmail || isProtectedUid;
      
      const lastSignIn = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime) : null;
      const isRecentlyActive = lastSignIn && lastSignIn > thirtyDaysAgo;
      
      const userInfo = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        created: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime,
        isProtected,
        isRecentlyActive,
        daysSinceLastSignIn: lastSignIn ? Math.floor((new Date().getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24)) : 'never'
      };
      
      if (isProtected) {
        protectedUsers.push(userInfo);
        console.log(`  🛡️  PROTECTED: ${user.email} (${user.uid})`);
      } else if (isRecentlyActive) {
        recentlyActive.push(userInfo);
        console.log(`  🟢 RECENTLY ACTIVE: ${user.email} (${user.uid}) - ${userInfo.daysSinceLastSignIn} days ago`);
      } else {
        candidatesForDeletion.push(userInfo);
        console.log(`  🗑️  CANDIDATE FOR DELETION: ${user.email} (${user.uid}) - ${userInfo.daysSinceLastSignIn} days since last sign-in`);
      }
    }
    
    // 3. Summary
    console.log('\n📊 Summary:');
    console.log(`  Protected users: ${protectedUsers.length}`);
    console.log(`  Recently active users: ${recentlyActive.length}`);
    console.log(`  Candidates for deletion: ${candidatesForDeletion.length}`);
    
    // 4. Check for Firestore data before deletion
    console.log('\n🔍 Checking Firestore data for candidates...');
    const usersWithData: any[] = [];
    
    for (const candidate of candidatesForDeletion) {
      try {
        const userDoc = await db.collection('users').doc(candidate.uid).get();
        if (userDoc.exists) {
          // Check subcollections
          const subcollections = ['envelopes', 'transactions', 'categories', 'monthlyBudgets', 'envelopeAllocations', 'appSettings', 'distributionTemplates'];
          let totalDocs = 0;
          
          for (const subcollectionName of subcollections) {
            const subcollectionSnapshot = await db.collection('users').doc(candidate.uid).collection(subcollectionName).get();
            totalDocs += subcollectionSnapshot.size;
          }
          
          if (totalDocs > 0) {
            usersWithData.push({ ...candidate, documentCount: totalDocs });
            console.log(`  ⚠️  ${candidate.email} has ${totalDocs} documents in Firestore - NOT deleting`);
          }
        }
      } catch (error: any) {
        console.log(`  ❌ Error checking ${candidate.email}:`, error.message);
      }
    }
    
    // 5. Final deletion candidates (no Firestore data, not protected, not recently active)
    const finalCandidates = candidatesForDeletion.filter(
      candidate => !usersWithData.find((u: any) => u.uid === candidate.uid)
    );
    
    console.log('\n🎯 Final candidates for deletion:');
    finalCandidates.forEach(candidate => {
      console.log(`  - ${candidate.email} (${candidate.uid}) - ${candidate.daysSinceLastSignIn} days inactive`);
    });
    
    const analysis: any = {
      summary: {
        totalUsers: allUsers.length,
        protectedUsers: protectedUsers.length,
        recentlyActive: recentlyActive.length,
        candidatesForDeletion: candidatesForDeletion.length,
        usersWithData: usersWithData.length,
        finalCandidates: finalCandidates.length
      },
      protectedUsers,
      recentlyActive,
      candidatesForDeletion,
      usersWithData,
      finalCandidates
    };
    
    // 6. DRY RUN - Don't actually delete unless explicitly requested
    const shouldDelete = req.query.delete === 'true';
    
    if (shouldDelete && finalCandidates.length > 0) {
      console.log('\n🔥 DELETING USERS (as requested)...');
      const deletedUsers = [];
      
      for (const candidate of finalCandidates) {
        try {
          await auth.getAuth().deleteUser(candidate.uid);
          deletedUsers.push(candidate);
          console.log(`  ✅ Deleted: ${candidate.email} (${candidate.uid})`);
        } catch (error: any) {
          console.log(`  ❌ Failed to delete ${candidate.email}:`, error.message);
        }
      }
      
      analysis.deletedUsers = deletedUsers;
      console.log(`\n✅ Successfully deleted ${deletedUsers.length} users`);
    } else if (finalCandidates.length > 0) {
      console.log('\n💡 DRY RUN COMPLETE - To actually delete these users, add ?delete=true to the URL');
      console.log('   This will permanently delete the Firebase Authentication accounts listed above');
    }
    
    res.status(200).json({
      message: shouldDelete ? 'Cleanup completed' : 'Dry run completed',
      analysis,
      deleteUrl: finalCandidates.length > 0 ? `${req.url}?delete=true` : null
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

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
  
  // Filter out old calls and count recent ones
  const recentCalls = (data.calls || []).filter((call: any) => call.timestamp > windowStart);
  
  if (recentCalls.length >= RATE_LIMIT_MAX_CALLS) {
    throw new HttpsError(
      'resource-exhausted',
      `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_CALLS} calls per ${RATE_LIMIT_WINDOW / 1000} seconds.`
    );
  }
  
  // Add this call and update
  await callsRef.update({
    calls: [...recentCalls, { timestamp: now }]
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