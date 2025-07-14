import { 
  signInAnonymously, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { auth } from './firebase';

// Admin user IDs (add your Firebase Auth UIDs here)
const ADMIN_UIDS = [
  // Add your admin UIDs here after you sign in once
  // 'your-firebase-uid-1',
  // 'your-firebase-uid-2'
];

export interface AuthUser {
  uid: string;
  isAnonymous: boolean;
  isAdmin: boolean;
}

class AuthService {
  private user: User | null = null;
  private authStateChangeListeners: ((user: AuthUser | null) => void)[] = [];

  constructor() {
    this.initAuth();
  }

  private initAuth() {
    onAuthStateChanged(auth, (firebaseUser) => {
      this.user = firebaseUser;
      const authUser = firebaseUser ? this.createAuthUser(firebaseUser) : null;
      
      // Notify all listeners
      this.authStateChangeListeners.forEach(listener => listener(authUser));
    });
  }

  private createAuthUser(firebaseUser: User): AuthUser {
    return {
      uid: firebaseUser.uid,
      isAnonymous: firebaseUser.isAnonymous,
      isAdmin: ADMIN_UIDS.includes(firebaseUser.uid)
    };
  }

  // Anonymous sign in for general users
  async signInAnonymously(): Promise<AuthUser> {
    try {
      const result = await signInAnonymously(auth);
      return this.createAuthUser(result.user);
    } catch (error) {
      console.error('Anonymous sign in failed:', error);
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  // Get current user
  getCurrentUser(): AuthUser | null {
    return this.user ? this.createAuthUser(this.user) : null;
  }

  // Check if user is admin
  isAdmin(): boolean {
    return this.user ? ADMIN_UIDS.includes(this.user.uid) : false;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.user !== null;
  }

  // Listen to auth state changes
  onAuthStateChange(listener: (user: AuthUser | null) => void): () => void {
    this.authStateChangeListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateChangeListeners.indexOf(listener);
      if (index > -1) {
        this.authStateChangeListeners.splice(index, 1);
      }
    };
  }

  // Get user fingerprint for rate limiting
  getUserFingerprint(): string {
    if (this.user) {
      return this.user.uid;
    }
    
    // Fallback to browser fingerprint for non-authenticated users
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx!.textBaseline = 'top';
    ctx!.font = '14px Arial';
    ctx!.fillText('Browser fingerprint', 2, 2);
    
    const fingerprint = canvas.toDataURL() + 
                       navigator.userAgent + 
                       navigator.language + 
                       screen.width + 
                       screen.height;
    
    return btoa(fingerprint).slice(0, 32);
  }

  // Auto-authenticate users (call this on app start)
  async ensureAuthenticated(): Promise<AuthUser> {
    if (this.user) {
      return this.createAuthUser(this.user);
    }

    // Auto sign in anonymously for new users
    return await this.signInAnonymously();
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService; 