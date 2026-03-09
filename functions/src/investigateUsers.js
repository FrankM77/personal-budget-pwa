const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK
initializeApp({
  credential: cert({
    projectId: process.env.GCLOUD_PROJECT,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const db = getFirestore();

exports.investigateUsers = async (req, res) => {
  try {
    console.log('🔍 Investigating user IDs in Firestore database...\n');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`👥 Total user documents found: ${usersSnapshot.size}`);
    
    const userIds = [];
    const userStats = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      userIds.push(userId);
      
      // Check subcollections for this user
      const subcollections = ['envelopes', 'transactions', 'categories', 'monthlyBudgets', 'envelopeAllocations', 'appSettings', 'distributionTemplates'];
      let totalDocuments = 0;
      let hasData = false;
      const collectionCounts = {};
      
      for (const subcollectionName of subcollections) {
        try {
          const subcollectionRef = db.collection('users').doc(userId).collection(subcollectionName);
          const subcollectionSnapshot = await subcollectionRef.get();
          totalDocuments += subcollectionSnapshot.size;
          collectionCounts[subcollectionName] = subcollectionSnapshot.size;
          if (subcollectionSnapshot.size > 0) hasData = true;
        } catch (error) {
          // Collection might not exist
          collectionCounts[subcollectionName] = 0;
        }
      }
      
      userStats.push({
        userId,
        totalDocuments,
        hasData,
        isEmpty: totalDocuments === 0,
        collectionCounts
      });
      
      console.log(`  ${userId}: ${totalDocuments} total documents ${hasData ? '(has data)' : '(empty)'}`);
      console.log(`    Details:`, collectionCounts);
    }
    
    // Summary
    const usersWithData = userStats.filter(u => u.hasData).length;
    const emptyUsers = userStats.filter(u => u.isEmpty).length;
    
    console.log('\n📈 Summary:');
    console.log(`  Users with data: ${usersWithData}`);
    console.log(`  Empty users: ${emptyUsers}`);
    console.log(`  Total users: ${usersSnapshot.size}`);
    
    // Check for potential issues
    const analysis = {
      totalUsers: usersSnapshot.size,
      usersWithData,
      emptyUsers,
      emptyUserIds: userStats.filter(u => u.isEmpty).map(u => u.userId),
      userStats: userStats
    };
    
    if (emptyUsers > 0) {
      console.log('\n⚠️  Potential Issues:');
      console.log(`  Found ${emptyUsers} empty user documents that might be from:`);
      console.log('  - Test accounts that were never used');
      console.log('  - Failed sign-ups that created partial records');
      console.log('  - Development/testing accounts');
      console.log('  - Deleted accounts that left orphaned user documents');
      
      console.log('\n🗑️  Empty user IDs to consider cleaning up:');
      userStats.filter(u => u.isEmpty).forEach(user => {
        console.log(`    - ${user.userId}`);
      });
    }
    
    res.status(200).json({
      message: 'Investigation complete',
      analysis
    });
    
  } catch (error) {
    console.error('❌ Error investigating user IDs:', error);
    res.status(500).json({ error: error.message });
  }
};
