interface QueuedVote {
  id: string;
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  winnerRating: number;
  loserRating: number;
  newWinnerRating: number;
  newLoserRating: number;
  browserId: string;
  timestamp: number;
  attempts?: number;
}

interface VoteQueueConfig {
  maxRetries: number;
  syncIntervalMs: number;
  maxQueueSize: number;
}

const DEFAULT_CONFIG: VoteQueueConfig = {
  maxRetries: 3,
  syncIntervalMs: 30000, // 30 seconds
  maxQueueSize: 100,
};

class VoteQueue {
  private config: VoteQueueConfig;
  private queueKey = 'hotsmash_vote_queue';
  private isProcessing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private eventListenersAttached = false;

  constructor(config: VoteQueueConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.attachEventListeners();
    this.startPeriodicSync();
  }

  private getQueue(): QueuedVote[] {
    try {
      const queue = localStorage.getItem(this.queueKey);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: QueuedVote[]): void {
    try {
      // Limit queue size to prevent localStorage bloat
      const limitedQueue = queue.slice(-this.config.maxQueueSize);
      localStorage.setItem(this.queueKey, JSON.stringify(limitedQueue));
    } catch (error) {
      console.error('Failed to save vote queue:', error);
    }
  }

  private generateVoteId(): string {
    return `vote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Queue a vote for later processing
  queueVote(vote: Omit<QueuedVote, 'id' | 'timestamp' | 'attempts'>): void {
    const queuedVote: QueuedVote = {
      ...vote,
      id: this.generateVoteId(),
      timestamp: Date.now(),
      attempts: 0,
    };

    const queue = this.getQueue();
    queue.push(queuedVote);
    this.saveQueue(queue);

    console.log(`Vote queued: ${vote.winnerName} vs ${vote.loserName}`);
  }

  // Get the current queue size
  getQueueSize(): number {
    return this.getQueue().length;
  }

  // Check if there are pending votes
  hasPendingVotes(): boolean {
    return this.getQueueSize() > 0;
  }

  // Process and send all queued votes
  async processQueue(): Promise<{ success: number; failed: number }> {
    if (this.isProcessing) {
      return { success: 0, failed: 0 };
    }

    this.isProcessing = true;
    let successCount = 0;
    let failedCount = 0;

    try {
      const queue = this.getQueue();
      if (queue.length === 0) {
        this.isProcessing = false;
        return { success: 0, failed: 0 };
      }

      console.log(`Processing ${queue.length} queued votes...`);

      // Import Firebase functions dynamically to avoid circular imports
      const { updateFounderRatings, recordVote } = await import('./firebaseService');

      const processPromises = queue.map(async (vote) => {
        try {
          vote.attempts = (vote.attempts || 0) + 1;

          // Send to Firebase
          await Promise.all([
            updateFounderRatings(
              vote.winnerId,
              vote.loserId,
              vote.newWinnerRating,
              vote.newLoserRating
            ),
            recordVote({
              winnerId: vote.winnerId,
              loserId: vote.loserId,
              winnerName: vote.winnerName,
              loserName: vote.loserName,
              browserId: vote.browserId,
            }),
          ]);

          console.log(`Vote processed successfully: ${vote.winnerName} vs ${vote.loserName}`);
          return { success: true, vote };
        } catch (error) {
          console.error(`Failed to process vote ${vote.id}:`, error);
          return { success: false, vote };
        }
      });

      const results = await Promise.allSettled(processPromises);
      const failedVotes: QueuedVote[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successCount++;
          } else {
            failedCount++;
            const vote = result.value.vote;
            // Retry failed votes if under retry limit
            if (vote.attempts < this.config.maxRetries) {
              failedVotes.push(vote);
            }
          }
        } else {
          failedCount++;
        }
      });

      // Update queue with only failed votes that should be retried
      this.saveQueue(failedVotes);

      console.log(`Vote processing complete: ${successCount} successful, ${failedCount} failed`);
    } catch (error) {
      console.error('Error processing vote queue:', error);
    } finally {
      this.isProcessing = false;
    }

    return { success: successCount, failed: failedCount };
  }

  // Attach event listeners for browser navigation/close events
  private attachEventListeners(): void {
    if (this.eventListenersAttached || typeof window === 'undefined') {
      return;
    }

    // Handle page unload (when user closes tab or navigates away)
    const handleBeforeUnload = () => {
      this.syncBeforeUnload();
    };

    // Handle page visibility change (when user switches tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && this.hasPendingVotes()) {
        this.processQueue().catch(console.error);
      }
    };

    // Handle page focus (when user returns to tab)
    const handleFocus = () => {
      if (this.hasPendingVotes()) {
        this.processQueue().catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    this.eventListenersAttached = true;
  }

  // Get cleanup function for React components
  getEventCleanup(): () => void {
    return () => {
      window.removeEventListener('beforeunload', this.syncBeforeUnload);
      document.removeEventListener('visibilitychange', () => {});
      window.removeEventListener('focus', () => {});
      this.eventListenersAttached = false;
    };
  }

  // Synchronous sending for beforeunload event (limited but tries)
  private syncBeforeUnload(): void {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    // Use sendBeacon for reliable delivery during page unload
    if ('sendBeacon' in navigator) {
      // Since we can't directly send to Firebase with sendBeacon,
      // we'll try a synchronous approach as fallback
      this.processQueue().catch(() => {
        // If async fails, at least the votes stay in localStorage
        // and will be processed when user returns
        console.log('Votes remain queued for next session');
      });
    }
  }

  // Start periodic sync to ensure votes don't stay queued too long
  private startPeriodicSync(): void {
    if (typeof window === 'undefined') return;

    this.syncInterval = setInterval(() => {
      if (this.hasPendingVotes() && !this.isProcessing) {
        this.processQueue().catch(console.error);
      }
    }, this.config.syncIntervalMs);
  }

  // Stop periodic sync
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Force immediate sync of all queued votes
  async forcSync(): Promise<{ success: number; failed: number }> {
    return this.processQueue();
  }

  // Clear all queued votes (for testing/reset)
  clearQueue(): void {
    localStorage.removeItem(this.queueKey);
    console.log('Vote queue cleared');
  }

  // Get queue statistics
  getQueueStats(): {
    pendingVotes: number;
    isProcessing: boolean;
    oldestVoteAge?: number;
  } {
    const queue = this.getQueue();
    const oldestVote = queue.length > 0 ? queue[0] : null;
    
    return {
      pendingVotes: queue.length,
      isProcessing: this.isProcessing,
      oldestVoteAge: oldestVote ? Date.now() - oldestVote.timestamp : undefined,
    };
  }

  // Demo function to test queue functionality (for testing purposes)
  addTestVote(): void {
    this.queueVote({
      winnerId: 'test-winner',
      loserId: 'test-loser',
      winnerName: 'Test Winner',
      loserName: 'Test Loser',
      winnerRating: 1200,
      loserRating: 1200,
      newWinnerRating: 1216,
      newLoserRating: 1184,
      browserId: 'test-browser',
    });
  }
}

// Export singleton instance
export const voteQueue = new VoteQueue();
export default voteQueue; 