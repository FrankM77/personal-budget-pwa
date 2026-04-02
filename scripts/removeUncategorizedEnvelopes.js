/**
 * Script to remove uncategorized envelopes from Firestore
 * 
 * Usage:
 *   1. Get your Firebase service account key and save as serviceAccountKey.json
 *   2. Run: node scripts/removeUncategorizedEnvelopes.js
 * 
 * WARNING: This will permanently delete envelopes from Firestore!
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Load service account key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found!');
  console.log('Please download your Firebase service account key and save it as:');
  console.log('  scripts/serviceAccountKey.json');
  console.log('\nTo get your service account key:');
  console.log('  1. Go to Firebase Console > Project Settings > Service Accounts');
  console.log('  2. Click "Generate new private key"');
  console.log('  3. Save the JSON file as serviceAccountKey.json in the scripts folder');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function removeUncategorizedEnvelopes() {
  console.log('🔍 Scanning for uncategorized envelopes...\n');

  // Get all users (assuming you know your user ID, or scan all)
  // For now, we'll need the user ID - let's prompt for it
  const userId = process.env.FIREBASE_USER_ID || process.argv[2];
  
  if (!userId) {
    console.log('Usage: node removeUncategorizedEnvelopes.js <userId>');
    console.log('   Or set FIREBASE_USER_ID environment variable');
    console.log('\nTo find your user ID:');
    console.log('  - Check Firebase Console > Authentication > Users');
    console.log('  - Or look at the URL when viewing your app');
    process.exit(1);
  }

  console.log(`👤 Target user: ${userId}\n`);

  try {
    // Get all envelopes for the user
    const envelopesRef = collection(db, 'users', userId, 'envelopes');
    const snapshot = await getDocs(envelopesRef);

    console.log(`📊 Total envelopes found: ${snapshot.size}\n`);

    // Find uncategorized envelopes
    const uncategorizedEnvelopes = [];
    const categorizedEnvelopes = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const envelope = { id: doc.id, ...data };
      
      // Check if envelope is uncategorized
      // "uncategorized" categoryId could be:
      // - undefined/null categoryId
      // - categoryId set to "uncategorized" string
      if (!data.categoryId || 
          data.categoryId === 'uncategorized' || 
          data.categoryId === '') {
        uncategorizedEnvelopes.push(envelope);
      } else {
        categorizedEnvelopes.push(envelope);
      }
    });

    console.log(`📁 Categorized envelopes: ${categorizedEnvelopes.length}`);
    console.log(`📁 Uncategorized envelopes: ${uncategorizedEnvelopes.length}\n`);

    if (uncategorizedEnvelopes.length === 0) {
      console.log('✅ No uncategorized envelopes found!');
      return;
    }

    // Display uncategorized envelopes
    console.log('📋 Uncategorized envelopes to remove:');
    uncategorizedEnvelopes.forEach((env, index) => {
      console.log(`  ${index + 1}. ${env.name} (ID: ${env.id})`);
    });
    console.log('');

    // Confirm deletion
    console.log('⚠️  WARNING: This will PERMANENTLY DELETE these envelopes!');
    console.log('   Their allocations and transactions will also be affected.\n');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question('Type "DELETE" to confirm: ', resolve);
    });
    readline.close();

    if (answer !== 'DELETE') {
      console.log('\n❌ Cancelled. No envelopes were deleted.');
      return;
    }

    console.log('\n🗑️  Deleting uncategorized envelopes...\n');

    // Delete each uncategorized envelope
    for (const envelope of uncategorizedEnvelopes) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'envelopes', envelope.id));
        console.log(`   ✅ Deleted: ${envelope.name}`);
      } catch (error) {
        console.log(`   ❌ Failed to delete ${envelope.name}: ${error.message}`);
      }
    }

    console.log('\n✅ Cleanup complete!');
    console.log(`   Deleted ${uncategorizedEnvelopes.length} uncategorized envelopes`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
removeUncategorizedEnvelopes();
