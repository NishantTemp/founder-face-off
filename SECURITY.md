# Security Measures for Hotsmash Firebase Integration

## 🔒 Environment Variables
- All Firebase configuration values are stored in `.env.local`
- The `.env.local` file is automatically ignored by Git (via `*.local` pattern in `.gitignore`)
- Environment variables are prefixed with `VITE_` to be accessible in the frontend
- **Never commit API keys directly to the repository**

## 🔐 Firebase Security Rules
To secure your Firestore database, apply these security rules in the Firebase Console:

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Founders collection - read only, no writes from client
    match /founders/{founderId} {
      allow read: if true;
      allow write: if false; // Only allow writes through Admin SDK or Cloud Functions
    }
    
    // Votes collection - write only, no reads needed from client
    match /votes/{voteId} {
      allow read: if false;
      allow write: if request.auth != null || true; // Allow anonymous writes for now
      allow create: if request.resource.data.keys().hasAll(['winnerId', 'loserId', 'winnerName', 'loserName', 'timestamp']);
    }
    
    // Stats collection - read only
    match /stats/{statId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## 🛡️ Additional Security Recommendations

### 1. **API Key Restrictions**
In Firebase Console:
- Go to Google Cloud Console → APIs & Services → Credentials
- Restrict your API key to specific domains
- Add your production domain(s) to the allowed list

### 2. **Authentication** (Future Enhancement)
- Implement Firebase Authentication for user accounts
- Restrict voting to authenticated users only
- Rate limiting per user

### 3. **Cloud Functions** (Recommended)
Move sensitive operations to Cloud Functions:
```javascript
// Example: Update ratings server-side
exports.processVote = functions.firestore
  .document('votes/{voteId}')
  .onCreate(async (snap, context) => {
    // Process ELO rating calculations securely
    // Update founder ratings
    // Prevent manipulation of rating calculations
  });
```

### 4. **Rate Limiting**
- Implement rate limiting to prevent spam voting
- Use Cloud Functions with Firebase Admin SDK
- Consider implementing CAPTCHA for suspicious activity

### 5. **Data Validation**
- Validate all data on the server side
- Use Firestore security rules for schema validation
- Sanitize user inputs

## 🚨 Security Checklist

- [x] API keys stored in environment variables
- [x] Environment file ignored by Git
- [x] Firebase config uses environment variables
- [x] Rate limiting implemented (client-side)
- [x] Duplicate vote prevention
- [x] Browser fingerprinting for user identification
- [ ] Firestore security rules configured
- [ ] API key domain restrictions set
- [ ] Authentication added (optional)
- [ ] Cloud Functions for sensitive operations (recommended)

## 🛡️ Rate Limiting Features

### Implemented Rate Limits:
- **2-second cooldown** between consecutive votes
- **60 votes per hour** maximum
- **200 votes per day** maximum
- **Duplicate vote prevention** - cannot vote on the same founder pair twice
- **Browser fingerprinting** for user identification without login

### How It Works:
1. **Local Storage Tracking**: Uses localStorage to track voting history per browser
2. **Browser Fingerprinting**: Creates a unique browser ID using canvas, user agent, and screen properties
3. **Pair Normalization**: Ensures A vs B and B vs A are treated as the same comparison
4. **Automatic Cleanup**: Removes vote records older than 24 hours
5. **Visual Feedback**: Shows when pairs have been voted on and displays cooldown timers

### Storage Structure:
```javascript
// localStorage keys used:
// - hotsmash_vote_history: Array of vote records with timestamps and pair IDs
// - hotsmash_last_vote: Timestamp of the last vote for cooldown
// - hotsmash_browser_id: Unique browser fingerprint
```

### Testing & Administration:
- Built-in admin panel for testing (bottom-right corner)
- View current voting statistics
- Reset voting history for testing
- Monitor rate limit effectiveness

## ⚠️ Important Notes

1. **Client-side API Keys**: Firebase client API keys are meant to be public but should still be restricted by domain
2. **Security Rules**: The real security comes from Firestore security rules, not hiding API keys
3. **Server-side Operations**: For production, move rating calculations to Cloud Functions
4. **Monitoring**: Set up Firebase monitoring and alerts for unusual activity

## 🔄 Environment Setup

1. Copy `.env.local.example` to `.env.local`
2. Add your Firebase configuration values
3. Never commit `.env.local` to version control
4. Use different Firebase projects for development/staging/production 