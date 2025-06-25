# Firebase Firestore Setup Instructions

The application is showing Firebase connection errors because Firestore needs to be properly configured. Follow these steps:

## 🔥 **Firebase Console Setup**

### 1. **Enable Firestore Database**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `hotsmash-e39ea`
3. Click **"Firestore Database"** in the sidebar
4. Click **"Create database"**
5. Choose **"Start in test mode"** (for now)
6. Select a location (choose closest to your users)

### 2. **Configure Security Rules**
Once Firestore is created, go to **Rules** tab and paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents for now (TESTING ONLY)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ WARNING**: These rules allow anyone to read/write. For production, use the secure rules from `SECURITY.md`.

### 3. **Verify Project Configuration**
Make sure your project ID matches in:
- Firebase Console URL: `https://console.firebase.google.com/project/hotsmash-e39ea`
- `.env` file: `VITE_FIREBASE_PROJECT_ID=hotsmash-e39ea`

## 🧪 **Testing the Setup**

After setup, the application should:
1. ✅ Load without infinite loading screen
2. ✅ Show "Firebase founders loaded: X" in console
3. ✅ Allow voting with real persistence
4. ✅ Display rankings that persist across refreshes

## 🔧 **Current Fallback Mode**

Until Firebase is configured, the app runs in **local mode**:
- ✅ All 40 founders load instantly
- ✅ Voting works with local state
- ✅ Rate limiting still functions
- ⚠️ Data doesn't persist across refreshes
- ⚠️ No cross-device synchronization

## 📋 **Troubleshooting**

### Console shows "Firebase timeout" or 400 errors:
1. Check if Firestore is enabled in Firebase Console
2. Verify project ID in `.env` file
3. Make sure security rules allow access
4. Try refreshing the page

### Still having issues:
1. Delete `.firebase` folder (if exists)
2. Clear browser cache
3. Check browser network tab for specific error details
4. Verify all environment variables are set correctly

## 🚀 **Production Security**

Once testing is complete, update Firestore rules to:
1. Restrict write access to founders collection
2. Add rate limiting at database level
3. Implement user authentication
4. Use the secure rules from `SECURITY.md`

The app works perfectly in local mode for now - Firebase adds persistence and cross-device sync! 