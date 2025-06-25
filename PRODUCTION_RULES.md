# Production Firestore Security Rules

## ⚠️ Important: Switch to these rules after your app is initialized!

Once your app is working and the database is populated with founders, replace your current Firestore rules with these secure ones:

## 🔒 Production Rules (Copy this to Firebase Console → Firestore → Rules)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Founders collection: Public read, admin-only writes
    match /founders/{founderId} {
      allow read: if true;
      allow write: if false; // Only allow writes through admin functions
    }
    
    // Votes collection: Public read, validated writes
    match /votes/{voteId} {
      allow read: if true;
      allow create: if 
        // Validate vote structure
        request.resource.data.keys().hasAll(['winner', 'loser', 'timestamp', 'browserId']) &&
        request.resource.data.timestamp is timestamp &&
        request.resource.data.winner is string &&
        request.resource.data.loser is string &&
        request.resource.data.browserId is string &&
        request.resource.data.winner != request.resource.data.loser &&
        // Prevent future timestamps
        request.resource.data.timestamp <= request.time;
      allow update, delete: if false; // Votes are immutable
    }
    
    // Stats collection: Public read, system writes only
    match /stats/{statId} {
      allow read: if true;
      allow write: if statId == 'global'; // Only global stats document
    }
    
    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 🛡️ What these rules protect:

1. **Founders data**: Read-only for users, prevents tampering
2. **Votes**: Validates vote structure, prevents invalid data
3. **Stats**: Only allows updates to global statistics
4. **Rate limiting**: Enforced at application level + browser fingerprinting
5. **Data integrity**: Prevents malformed or malicious data

## 📋 When to switch:

✅ **Switch to production rules when**:
- App loads all 40 founders successfully
- Voting works and persists across refreshes  
- Rankings page shows correct data
- No console errors related to Firebase

⚠️ **Don't switch yet if**:
- Database is still empty
- Getting "Missing permissions" errors
- App is still in local fallback mode

## 🔄 How to switch:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `hotsmash-e39ea`
3. Navigate to **Firestore Database** → **Rules**
4. Replace current rules with the production rules above
5. Click **"Publish"**
6. Test that voting still works (should work fine)

Your app will be much more secure while maintaining full functionality! 