import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  increment
} from 'firebase/firestore';
import { db } from './firebase';

export interface Founder {
  id: string;
  name: string;
  company: string;
  username: string;
  image: string;
  rating: number;
  votes: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Vote {
  id?: string;
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  timestamp: any;
}

// Collection references
const FOUNDERS_COLLECTION = 'founders';
const VOTES_COLLECTION = 'votes';
const STATS_COLLECTION = 'stats';

// Initialize founders data (run once)
export const initializeFounders = async (foundersData: Omit<Founder, 'id' | 'createdAt' | 'updatedAt'>[]) => {
  try {
    const existingFounders = await getFounders();
    if (existingFounders.length > 0) {
      console.log('Founders already initialized');
      return existingFounders;
    }

    const createdFounders: Founder[] = [];
    for (const founder of foundersData) {
      const docRef = await addDoc(collection(db, FOUNDERS_COLLECTION), {
        ...founder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      createdFounders.push({
        id: docRef.id,
        ...founder,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    console.log('Founders initialized successfully');
    return createdFounders;
  } catch (error) {
    console.error('Error initializing founders:', error);
    throw error;
  }
};

// Get all founders
export const getFounders = async (): Promise<Founder[]> => {
  try {
    const q = query(collection(db, FOUNDERS_COLLECTION), orderBy('rating', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Founder));
  } catch (error) {
    console.error('Error getting founders:', error);
    throw error;
  }
};

// Update founder ratings
export const updateFounderRatings = async (winnerId: string, loserId: string, newWinnerRating: number, newLoserRating: number) => {
  try {
    const winnerRef = doc(db, FOUNDERS_COLLECTION, winnerId);
    const loserRef = doc(db, FOUNDERS_COLLECTION, loserId);

    await Promise.all([
      updateDoc(winnerRef, {
        rating: newWinnerRating,
        votes: increment(1),
        updatedAt: serverTimestamp()
      }),
      updateDoc(loserRef, {
        rating: newLoserRating,
        votes: increment(1),
        updatedAt: serverTimestamp()
      })
    ]);

    console.log('Founder ratings updated successfully');
  } catch (error) {
    console.error('Error updating founder ratings:', error);
    throw error;
  }
};



// Record a vote with browser fingerprint
export const recordVote = async (vote: Omit<Vote, 'id' | 'timestamp'> & { browserId?: string }) => {
  try {
    await addDoc(collection(db, VOTES_COLLECTION), {
      ...vote,
      timestamp: serverTimestamp()
    });
    
    console.log('Vote recorded successfully');
  } catch (error) {
    console.error('Error recording vote:', error);
    throw error;
  }
};

// Get total votes count
export const getTotalVotes = async (): Promise<number> => {
  try {
    const querySnapshot = await getDocs(collection(db, VOTES_COLLECTION));
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting total votes:', error);
    return 0;
  }
};

// Update app statistics
export const updateStats = async (totalVotes: number) => {
  try {
    const statsRef = doc(db, STATS_COLLECTION, 'global');
    await setDoc(statsRef, {
      totalVotes,
      lastUpdated: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating stats:', error);
    throw error;
  }
}; 