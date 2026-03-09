#!/usr/bin/env node

/**
 * Script to investigate user IDs in Firestore database
 * This will help identify why there are more user IDs than expected
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Firebase configuration (you'll need to set this)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function investigateUserIds() {
  console.log('🔍 Investigating user IDs in Firestore database...\n');
  
  try {
    // Get all collections at the root level
    const collections = await getDocs(collection(db, '__collections__'));
    
    console.log('📊 Root level collections found:');
    for (const collectionDoc of collections.docs) {
      console.log(`  - ${collectionDoc.id}`);
    }
    
    // Check if there's a 'users' collection
    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);
    
    console.log(`\n👥 Total user documents found: ${usersSnapshot.size}`);
    
    if (usersSnapshot.size > 0) {
      console.log('\n📋 User ID Analysis:');
      
      const userIds = [];
      const userStats = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        userIds.push(userId);
        
        // Check subcollections for this user
        const subcollections = ['envelopes', 'transactions', 'categories', 'monthlyBudgets', 'envelopeAllocations', 'appSettings', 'distributionTemplates'];
        let totalDocuments = 0;
        let hasData = false;
        
        for (const subcollectionName of subcollections) {
          try {
            const subcollectionRef = collection(db, 'users', userId, subcollectionName);
            const subcollectionSnapshot = await getDocs(subcollectionRef);
            totalDocuments += subcollectionSnapshot.size;
            if (subcollectionSnapshot.size > 0) hasData = true;
          } catch (error) {
            // Collection might not exist
          }
        }
        
        userStats.push({
          userId,
          totalDocuments,
          hasData,
          isEmpty: totalDocuments === 0
        });
        
        console.log(`  ${userId}: ${totalDocuments} total documents ${hasData ? '(has data)' : '(empty)'}`);
      }
      
      // Summary
      const usersWithData = userStats.filter(u => u.hasData).length;
      const emptyUsers = userStats.filter(u => u.isEmpty).length;
      
      console.log('\n📈 Summary:');
      console.log(`  Users with data: ${usersWithData}`);
      console.log(`  Empty users: ${emptyUsers}`);
      console.log(`  Total users: ${usersSnapshot.size}`);
      
      // Check for potential issues
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
      
    } else {
      console.log('No users collection found or no users in database');
    }
    
  } catch (error) {
    console.error('❌ Error investigating user IDs:', error);
  }
}

// Run the investigation
investigateUserIds().then(() => {
  console.log('\n✅ Investigation complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
