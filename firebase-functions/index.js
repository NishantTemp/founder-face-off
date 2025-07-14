const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { initializeApp } = require('firebase-admin/app');

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();
const auth = getAuth();

// Admin UIDs (must match your authService.ts)
const ADMIN_UIDS = [
  // Add your admin UIDs here
];

// Rate limiting configuration
const RATE_LIMITS = {
  votesPerHour: 50,
  votesPerDay: 200,
  maxUniqueRounds: 100
};

// Helper functions
function isAdmin(uid) {
  return ADMIN_UIDS.includes(uid);
}

function calculateEloRating(winnerRating, loserRating, kFactor = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
  
  const newWinnerRating = Math.round(winnerRating + kFactor * (1 - expectedWinner));
  const newLoserRating = Math.round(loserRating + kFactor * (0 - expectedLoser));
  
  return { newWinnerRating, newLoserRating };
}

async function checkRateLimit(uid) {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const votesRef = db.collection('votes');
  
  // Check hourly limit
  const hourlyVotes = await votesRef
    .where('userId', '==', uid)
    .where('timestamp', '>', hourAgo)
    .get();
    
  if (hourlyVotes.size >= RATE_LIMITS.votesPerHour) {
    throw new HttpsError('resource-exhausted', 'Hourly vote limit exceeded');
  }
  
  // Check daily limit
  const dailyVotes = await votesRef
    .where('userId', '==', uid)
    .where('timestamp', '>', dayAgo)
    .get();
    
  if (dailyVotes.size >= RATE_LIMITS.votesPerDay) {
    throw new HttpsError('resource-exhausted', 'Daily vote limit exceeded');
  }
  
  return true;
}

async function validateFounderExists(founderId) {
  const founderDoc = await db.collection('founders').doc(founderId).get();
  if (!founderDoc.exists) {
    throw new HttpsError('not-found', `Founder ${founderId} not found`);
  }
  return founderDoc.data();
}

// SECURE VOTE PROCESSING FUNCTION
exports.processVote = onCall(async (request) => {
  const { data, auth: requestAuth } = request;
  
  // Check authentication
  if (!requestAuth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to vote');
  }
  
  const { winnerId, loserId } = data;
  
  // Validate input
  if (!winnerId || !loserId || winnerId === loserId) {
    throw new HttpsError('invalid-argument', 'Invalid vote data');
  }
  
  try {
    // Check rate limiting
    await checkRateLimit(requestAuth.uid);
    
    // Validate founders exist
    const [winner, loser] = await Promise.all([
      validateFounderExists(winnerId),
      validateFounderExists(loserId)
    ]);
    
    // Calculate new ratings
    const { newWinnerRating, newLoserRating } = calculateEloRating(
      winner.rating, 
      loser.rating
    );
    
    // Use a transaction to ensure consistency
    const result = await db.runTransaction(async (transaction) => {
      const winnerRef = db.collection('founders').doc(winnerId);
      const loserRef = db.collection('founders').doc(loserId);
      const voteRef = db.collection('votes').doc();
      const statsRef = db.collection('stats').doc('global');
      
      // Update winner
      transaction.update(winnerRef, {
        rating: newWinnerRating,
        votes: winner.votes + 1,
        updatedAt: new Date()
      });
      
      // Update loser
      transaction.update(loserRef, {
        rating: newLoserRating,
        votes: loser.votes + 1,
        updatedAt: new Date()
      });
      
      // Record vote
      transaction.set(voteRef, {
        winnerId,
        loserId,
        winnerName: winner.name,
        loserName: loser.name,
        userId: requestAuth.uid,
        browserId: data.browserId || requestAuth.uid,
        timestamp: new Date(),
        winnerRatingBefore: winner.rating,
        loserRatingBefore: loser.rating,
        winnerRatingAfter: newWinnerRating,
        loserRatingAfter: newLoserRating
      });
      
      // Update global stats
      transaction.set(statsRef, {
        totalVotes: db.FieldValue.increment(1),
        lastUpdated: new Date()
      }, { merge: true });
      
      return {
        winnerId,
        loserId,
        newWinnerRating,
        newLoserRating,
        voteId: voteRef.id
      };
    });
    
    return result;
    
  } catch (error) {
    console.error('Vote processing error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to process vote');
  }
});

// SECURE FOUNDER CREATION (Admin only)
exports.createFounder = onCall(async (request) => {
  const { data, auth: requestAuth } = request;
  
  // Check authentication and admin status
  if (!requestAuth || !isAdmin(requestAuth.uid)) {
    throw new HttpsError('permission-denied', 'Only admins can create founders');
  }
  
  const { name, company, username, image } = data;
  
  // Validate input
  if (!name || !company || !username || !image) {
    throw new HttpsError('invalid-argument', 'Missing required founder data');
  }
  
  try {
    // Check if founder already exists
    const existingFounder = await db.collection('founders')
      .where('username', '==', username)
      .get();
      
    if (!existingFounder.empty) {
      throw new HttpsError('already-exists', 'Founder with this username already exists');
    }
    
    // Create founder
    const founderRef = await db.collection('founders').add({
      name,
      company,
      username,
      image,
      rating: 1200,
      votes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: requestAuth.uid
    });
    
    // Log admin action
    await db.collection('adminLogs').add({
      action: 'CREATE_FOUNDER',
      adminUid: requestAuth.uid,
      founderId: founderRef.id,
      founderData: { name, company, username, image },
      timestamp: new Date()
    });
    
    return {
      founderId: founderRef.id,
      message: 'Founder created successfully'
    };
    
  } catch (error) {
    console.error('Founder creation error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to create founder');
  }
});

// GET USER STATS (for rate limiting display)
exports.getUserStats = onCall(async (request) => {
  const { auth: requestAuth } = request;
  
  if (!requestAuth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  try {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const votesRef = db.collection('votes');
    
    const [hourlyVotes, dailyVotes] = await Promise.all([
      votesRef.where('userId', '==', requestAuth.uid).where('timestamp', '>', hourAgo).get(),
      votesRef.where('userId', '==', requestAuth.uid).where('timestamp', '>', dayAgo).get()
    ]);
    
    return {
      votesThisHour: hourlyVotes.size,
      votesToday: dailyVotes.size,
      maxVotesPerHour: RATE_LIMITS.votesPerHour,
      maxVotesPerDay: RATE_LIMITS.votesPerDay,
      isAdmin: isAdmin(requestAuth.uid)
    };
    
  } catch (error) {
    console.error('User stats error:', error);
    throw new HttpsError('internal', 'Failed to get user stats');
  }
});

// ADMIN: Get all votes for a founder (moderation)
exports.getFounderVotes = onCall(async (request) => {
  const { data, auth: requestAuth } = request;
  
  if (!requestAuth || !isAdmin(requestAuth.uid)) {
    throw new HttpsError('permission-denied', 'Admin access required');
  }
  
  const { founderId } = data;
  
  try {
    const votes = await db.collection('votes')
      .where('winnerId', '==', founderId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
      
    return votes.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
  } catch (error) {
    console.error('Get founder votes error:', error);
    throw new HttpsError('internal', 'Failed to get founder votes');
  }
}); 