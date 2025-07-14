import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import app from './firebase';
import { authService } from './authService';

// Initialize Cloud Functions
const functions = getFunctions(app);

// Cloud Function references
const processVoteFunction = httpsCallable(functions, 'processVote');
const createFounderFunction = httpsCallable(functions, 'createFounder');
const getUserStatsFunction = httpsCallable(functions, 'getUserStats');
const getFounderVotesFunction = httpsCallable(functions, 'getFounderVotes');

export interface SecureVoteResult {
  winnerId: string;
  loserId: string;
  newWinnerRating: number;
  newLoserRating: number;
  voteId: string;
}

export interface UserStats {
  votesThisHour: number;
  votesToday: number;
  maxVotesPerHour: number;
  maxVotesPerDay: number;
  isAdmin: boolean;
}

export interface FounderCreationData {
  name: string;
  company: string;
  username: string;
  image: string;
}

class SecureVotingService {

  // Process a vote through secure Cloud Function
  async processVote(winnerId: string, loserId: string): Promise<SecureVoteResult> {
    try {
      // Ensure user is authenticated
      await authService.ensureAuthenticated();
      
      const result = await processVoteFunction({
        winnerId,
        loserId,
        browserId: authService.getUserFingerprint()
      });
      
      return result.data as SecureVoteResult;
    } catch (error: any) {
      console.error('Secure vote processing failed:', error);
      
      // Handle specific error types
      if (error.code === 'functions/resource-exhausted') {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.code === 'functions/unauthenticated') {
        throw new Error('Authentication required. Please refresh the page.');
      } else if (error.code === 'functions/invalid-argument') {
        throw new Error('Invalid vote data.');
      } else {
        throw new Error('Failed to process vote. Please try again.');
      }
    }
  }

  // Get user voting statistics
  async getUserStats(): Promise<UserStats> {
    try {
      await authService.ensureAuthenticated();
      
      const result = await getUserStatsFunction();
      return result.data as UserStats;
    } catch (error: any) {
      console.error('Failed to get user stats:', error);
      throw new Error('Failed to load user statistics.');
    }
  }

  // Create a new founder (admin only)
  async createFounder(founderData: FounderCreationData): Promise<{ founderId: string; message: string }> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser?.isAdmin) {
        throw new Error('Admin access required to create founders.');
      }
      
      const result = await createFounderFunction(founderData);
      return result.data as { founderId: string; message: string };
    } catch (error: any) {
      console.error('Failed to create founder:', error);
      
      if (error.code === 'functions/permission-denied') {
        throw new Error('Admin access required to create founders.');
      } else if (error.code === 'functions/already-exists') {
        throw new Error('A founder with this username already exists.');
      } else if (error.code === 'functions/invalid-argument') {
        throw new Error('Invalid founder data provided.');
      } else {
        throw new Error('Failed to create founder. Please try again.');
      }
    }
  }

  // Get votes for a specific founder (admin only)
  async getFounderVotes(founderId: string): Promise<any[]> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser?.isAdmin) {
        throw new Error('Admin access required.');
      }
      
      const result = await getFounderVotesFunction({ founderId });
      return result.data as any[];
    } catch (error: any) {
      console.error('Failed to get founder votes:', error);
      
      if (error.code === 'functions/permission-denied') {
        throw new Error('Admin access required.');
      } else {
        throw new Error('Failed to load founder votes.');
      }
    }
  }

  // Check if current user is admin
  isAdmin(): boolean {
    return authService.isAdmin();
  }

  // Get current user info
  getCurrentUser() {
    return authService.getCurrentUser();
  }
}

// Export singleton instance
export const secureVotingService = new SecureVotingService();
export default secureVotingService; 