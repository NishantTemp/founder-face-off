interface VoteRecord {
  timestamp: number;
  pair: string; // "founderId1-founderId2" or "founderId2-founderId1"
}

interface RateLimitConfig {
  maxVotesPerHour: number;
  maxVotesPerDay: number;
  cooldownBetweenVotes: number; // milliseconds
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxVotesPerHour: 60, // 60 votes per hour
  maxVotesPerDay: 200, // 200 votes per day
  cooldownBetweenVotes: 2000, // 2 seconds between votes
};

class RateLimiter {
  private config: RateLimitConfig;
  private storageKey = 'hotsmash_vote_history';
  private lastVoteKey = 'hotsmash_last_vote';
  private browserIdKey = 'hotsmash_browser_id';

  constructor(config: RateLimitConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.initializeBrowserId();
  }

  private initializeBrowserId(): void {
    if (!localStorage.getItem(this.browserIdKey)) {
      // Create a simple browser fingerprint
      const browserFingerprint = this.generateBrowserFingerprint();
      localStorage.setItem(this.browserIdKey, browserFingerprint);
    }
  }

  private generateBrowserFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Browser fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      Math.random().toString(36).substring(7) // Add some randomness
    ].join('|');

    return btoa(fingerprint).substring(0, 32);
  }

  private getVoteHistory(): VoteRecord[] {
    try {
      const history = localStorage.getItem(this.storageKey);
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  }

  private saveVoteHistory(history: VoteRecord[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save vote history:', error);
    }
  }

  private getLastVoteTime(): number {
    try {
      const lastVote = localStorage.getItem(this.lastVoteKey);
      return lastVote ? parseInt(lastVote, 10) : 0;
    } catch {
      return 0;
    }
  }

  private setLastVoteTime(timestamp: number): void {
    try {
      localStorage.setItem(this.lastVoteKey, timestamp.toString());
    } catch (error) {
      console.error('Failed to save last vote time:', error);
    }
  }

  private normalizePair(founderId1: string, founderId2: string): string {
    // Always put the smaller ID first to ensure consistency
    return founderId1 < founderId2 
      ? `${founderId1}-${founderId2}` 
      : `${founderId2}-${founderId1}`;
  }

  private cleanOldVotes(history: VoteRecord[]): VoteRecord[] {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    return history.filter(vote => vote.timestamp > oneDayAgo);
  }

  canVote(founderId1: string, founderId2: string): {
    allowed: boolean;
    reason?: string;
    remainingTime?: number;
  } {
    const now = Date.now();
    const lastVoteTime = this.getLastVoteTime();
    let history = this.getVoteHistory();

    // Clean old votes (older than 24 hours)
    history = this.cleanOldVotes(history);
    this.saveVoteHistory(history);

    // Check cooldown between votes
    const timeSinceLastVote = now - lastVoteTime;
    if (timeSinceLastVote < this.config.cooldownBetweenVotes) {
      const remainingTime = this.config.cooldownBetweenVotes - timeSinceLastVote;
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil(remainingTime / 1000)} seconds before voting again`,
        remainingTime
      };
    }

    // Check if this specific pair has been voted on before
    const pairKey = this.normalizePair(founderId1, founderId2);
    const hasVotedOnPair = history.some(vote => vote.pair === pairKey);
    
    if (hasVotedOnPair) {
      return {
        allowed: false,
        reason: 'You have already voted on this comparison'
      };
    }

    // Check hourly limit
    const oneHourAgo = now - (60 * 60 * 1000);
    const votesInLastHour = history.filter(vote => vote.timestamp > oneHourAgo).length;
    
    if (votesInLastHour >= this.config.maxVotesPerHour) {
      return {
        allowed: false,
        reason: `Hourly voting limit reached (${this.config.maxVotesPerHour} votes/hour)`
      };
    }

    // Check daily limit
    const votesInLastDay = history.length; // Already cleaned to 24 hours
    
    if (votesInLastDay >= this.config.maxVotesPerDay) {
      return {
        allowed: false,
        reason: `Daily voting limit reached (${this.config.maxVotesPerDay} votes/day)`
      };
    }

    return { allowed: true };
  }

  recordVote(founderId1: string, founderId2: string): void {
    const now = Date.now();
    const pairKey = this.normalizePair(founderId1, founderId2);
    
    let history = this.getVoteHistory();
    history = this.cleanOldVotes(history);
    
    // Add new vote record
    history.push({
      timestamp: now,
      pair: pairKey
    });

    this.saveVoteHistory(history);
    this.setLastVoteTime(now);
  }

  getVotingStats(): {
    votesToday: number;
    votesThisHour: number;
    uniquePairsVoted: number;
    maxVotesPerDay: number;
    maxVotesPerHour: number;
  } {
    const now = Date.now();
    let history = this.getVoteHistory();
    history = this.cleanOldVotes(history);

    const oneHourAgo = now - (60 * 60 * 1000);
    const votesThisHour = history.filter(vote => vote.timestamp > oneHourAgo).length;

    return {
      votesToday: history.length,
      votesThisHour,
      uniquePairsVoted: new Set(history.map(vote => vote.pair)).size,
      maxVotesPerDay: this.config.maxVotesPerDay,
      maxVotesPerHour: this.config.maxVotesPerHour
    };
  }

  resetVotingHistory(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.lastVoteKey);
  }

  getBrowserId(): string {
    return localStorage.getItem(this.browserIdKey) || 'unknown';
  }
}

export const rateLimiter = new RateLimiter();
export type { RateLimitConfig }; 