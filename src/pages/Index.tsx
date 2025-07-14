import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { 
  Founder,
  getFounders,
  initializeFounders,
  updateFounderRatings,
  recordVote,
  getTotalVotes
} from '@/lib/firebaseService';
import { rateLimiter } from '@/lib/rateLimiter';
import voteQueue from '@/lib/voteQueue';
import { getImageKitPath, convertLocalToImageKit } from '@/lib/cdn';
import { Image as ImageKitImage } from '@imagekit/react';

import { foundersData } from '@/data/founders';





// Using the real founders data

const Index = () => {
  const [founders, setFounders] = useState<Founder[]>([]);
  const [currentPair, setCurrentPair] = useState<[Founder, Founder] | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Elo rating calculation (original Facemash algorithm)
  const calculateEloRating = (winnerRating: number, loserRating: number) => {
    const K = 32; // K-factor
    const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
    
    const newWinnerRating = Math.round(winnerRating + K * (1 - expectedWinner));
    const newLoserRating = Math.round(loserRating + K * (0 - expectedLoser));
    
    return { newWinnerRating, newLoserRating };
  };

  // Get random pair of founders
  const getRandomPair = (foundersArray: Founder[]): [Founder, Founder] => {
    const shuffled = [...foundersArray].sort(() => 0.5 - Math.random());
    return [shuffled[0], shuffled[1]];
  };

  // Load founders data - show local immediately, sync with Firebase in background
  const loadFounders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Show local data immediately for fast UI
      const localFounders = foundersData.map((f, index) => ({ 
        ...f, 
        id: `local-${index}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      // Set local data immediately to show UI fast
      setFounders(localFounders);
      setTotalVotes(0);
      setLoading(false);
      
      // Now try to sync with Firebase in background (with shorter timeout)
      setSyncing(true);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 3000) // Reduced to 3 seconds
      );
      
      try {
        const existingFounders = await Promise.race([
          getFounders(),
          timeoutPromise
        ]) as Founder[];
        console.log('Firebase founders fetched:', existingFounders);
        if (existingFounders.length > 0) {
          console.log('First Firebase founder:', existingFounders[0]);
          console.log('First Firebase founder ID:', existingFounders[0].id);
        }
        
        if (existingFounders.length > 0) {
          // Update with Firebase data if available
          setFounders(existingFounders);
          setCurrentPair(getRandomPair(existingFounders)); // Reset current pair to use Firebase founders
          console.log('Set founders from Firebase and reset currentPair.');
          
          // Get total votes in background
          try {
            const votes = await getTotalVotes();
            setTotalVotes(votes);
          } catch (voteError) {
            // Keep local total votes count
          }
        } else {
          // Try to initialize Firebase with local data
          try {
            const initialized = await initializeFounders(foundersData);
            setFounders(initialized);
          } catch (initError) {
            // Keep using local data
          }
        }
      } catch (firebaseError) {
        // Silently continue with local data - no error shown to user
        console.log('Firebase sync failed, using local data:', firebaseError);
      } finally {
        setSyncing(false);
      }
      
    } catch (err) {
      // This should rarely happen now since we show local data first
      setError('Failed to load data. Please try again.');
      setLoading(false);
      setSyncing(false);
    }
  };

  // Handle vote
  const handleVote = async (winnerId: string, loserId: string) => {
    console.log('handleVote called', { winnerId, loserId });
    try {
      // Check rate limiting
      const rateLimitCheck = rateLimiter.canVote(winnerId, loserId);
      
      if (!rateLimitCheck.allowed) {
        setRateLimitMessage(rateLimitCheck.reason || 'Vote not allowed');
        
        // If there's a remaining time, start countdown
        if (rateLimitCheck.remainingTime) {
          setCooldownTimer(Math.ceil(rateLimitCheck.remainingTime / 1000));
          const interval = setInterval(() => {
            setCooldownTimer(prev => {
              if (prev <= 1) {
                clearInterval(interval);
                setRateLimitMessage(null);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          // For other types of limits, clear message after 5 seconds
          setTimeout(() => {
            setRateLimitMessage(null);
          }, 5000);
        }
        return;
      }

      const winner = founders.find(f => f.id === winnerId);
      const loser = founders.find(f => f.id === loserId);
      
      if (!winner || !loser) return;
      
      const { newWinnerRating, newLoserRating } = calculateEloRating(winner.rating, loser.rating);
      
      // Record the vote in rate limiter first
      rateLimiter.recordVote(winnerId, loserId);
      
      // Queue the vote for later processing instead of immediate Firebase call
      if (!winnerId.startsWith('local-')) {
        voteQueue.queueVote({
          winnerId,
          loserId,
          winnerName: winner.name,
          loserName: loser.name,
          winnerRating: winner.rating,
          loserRating: loser.rating,
          newWinnerRating,
          newLoserRating,
          browserId: rateLimiter.getBrowserId(),
        });
      }
      
      // Update local state IMMEDIATELY for instant UX
      setFounders(prevFounders => {
        const updatedFounders = prevFounders.map(founder => {
          if (founder.id === winnerId) {
            return { ...founder, rating: newWinnerRating, votes: founder.votes + 1 };
          } else if (founder.id === loserId) {
            return { ...founder, rating: newLoserRating, votes: founder.votes + 1 };
          }
          return founder;
        });
        
        // Set new random pair from updated data IMMEDIATELY
        setCurrentPair(getRandomPair(updatedFounders));
        return updatedFounders;
      });
      
      setTotalVotes(prev => prev + 1);
      
      // Clear any existing rate limit messages
      setRateLimitMessage(null);
      setCooldownTimer(0);
      
    } catch (err) {
      setError('Failed to record vote. Please try again.');
    }
  };

  // Check if current pair has been voted on
  const hasVotedOnCurrentPair = currentPair ? !rateLimiter.canVote(currentPair[0].id, currentPair[1].id).allowed &&
    rateLimiter.canVote(currentPair[0].id, currentPair[1].id).reason === 'You have already voted on this comparison' : false;

  // Initialize data on component mount
  useEffect(() => {
    loadFounders();
  }, []);

  // Process any existing queued votes when component mounts and cleanup on unmount
  useEffect(() => {
    // Process existing votes in queue on mount
    if (voteQueue.hasPendingVotes()) {
      voteQueue.processQueue().catch(console.error);
    }

    // Cleanup function when component unmounts
    return () => {
      // Force sync any remaining votes before unmounting
      if (voteQueue.hasPendingVotes()) {
        voteQueue.forcSync().catch(console.error);
      }
    };
  }, []);

  // Set initial pair when founders data is loaded
  useEffect(() => {
    if (founders.length >= 2 && !currentPair) {
      setCurrentPair(getRandomPair(founders));
    }
  }, [founders, currentPair]);

  // Periodic sync with Firebase every 30 seconds (background)
  useEffect(() => {
    if (founders.length > 0 && !founders[0].id.startsWith('local-')) {
      const syncInterval = setInterval(() => {
        getFounders().then(updatedFounders => {
          setFounders(updatedFounders);
        }).catch(() => {
          // Silent fail for background sync
        });
      }, 30000); // Sync every 30 seconds

      return () => clearInterval(syncInterval);
    }
  }, [founders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#8B0000] mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading founders data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadFounders} className="bg-[#8B0000] hover:bg-[#A00000]">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!currentPair || founders.length < 2) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-lg text-gray-600">Not enough founders to compare.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#8B0000] text-white py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-center text-2xl font-bold tracking-wider">HOTSMASH</h1>
            
          </div>
          <p className="text-center text-sm mt-1 opacity-90">
            Built by{' '}
            <a 
              href="https://twitter.com/ChandraDvitiyah" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white hover:underline font-medium"
            >
              @ChandraDvitiyah
            </a>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Instructions */}
        <div className="text-center mb-8">
          <p className="text-gray-900 font-semibold text-lg">
            Whose Startup's Hotter? Click to Choose.
          </p>
          
          {/* Rate Limit Message */}
          {rateLimitMessage && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg max-w-md mx-auto">
              <p className="text-sm">
                {rateLimitMessage}
                {cooldownTimer > 0 && (
                  <span className="font-semibold"> ({cooldownTimer}s)</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Skip button for already voted pairs */}
        {hasVotedOnCurrentPair && (
          <div className="text-center mb-4">
            <Button 
              onClick={() => setCurrentPair(getRandomPair(founders))}
              variant="outline" 
              className="text-[#8B0000] border-[#8B0000] hover:bg-[#8B0000] hover:text-white"
            >
              Skip This Comparison
            </Button>
          </div>
        )}

        {/* Voting Interface */}
        <div className="flex flex-col md:flex-row gap-8 items-center justify-center mb-8">
          {/* Left Founder */}
          <div className="text-center relative">
            <Card className={`p-4 cursor-pointer hover:shadow-lg transition-shadow border-2 ${
              hasVotedOnCurrentPair 
                ? 'border-gray-400 bg-gray-50 opacity-75' 
                : 'border-gray-200 hover:border-[#8B0000]'
            }`}
                  onClick={() => handleVote(currentPair[0].id, currentPair[1].id)}>
              <ImageKitImage
                src={currentPair[0].image}
                alt={currentPair[0].name}
                className="w-48 h-64 face-crop rounded mb-4 mx-auto"
                loading="lazy"
                transformation={[{
                  height: '256',
                  width: '192',
                  crop: 'maintain_ratio'
                }]}
              />
              <h3 className="font-semibold text-lg mb-1">{currentPair[0].name}</h3>
              <p className="text-gray-600 text-sm mb-1">{currentPair[0].company}</p>
              <p className="text-blue-600 text-sm mb-2">{currentPair[0].username}</p>
              <p className="text-xs text-gray-500">Rating: {currentPair[0].rating}</p>
            </Card>
            {hasVotedOnCurrentPair && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                ✓ Voted
              </div>
            )}
          </div>

          {/* VS */}
          <div className="text-center">
            <span className="text-4xl font-bold text-[#8B0000]">VS</span>
          </div>

          {/* Right Founder */}
          <div className="text-center relative">
            <Card className={`p-4 cursor-pointer hover:shadow-lg transition-shadow border-2 ${
              hasVotedOnCurrentPair 
                ? 'border-gray-400 bg-gray-50 opacity-75' 
                : 'border-gray-200 hover:border-[#8B0000]'
            }`}
                  onClick={() => handleVote(currentPair[1].id, currentPair[0].id)}>
              <ImageKitImage
                src={currentPair[1].image}
                alt={currentPair[1].name}
                className="w-48 h-64 face-crop rounded mb-4 mx-auto"
                loading="lazy"
                transformation={[{
                  height: '256',
                  width: '192',
                  crop: 'maintain_ratio'
                }]}
              />
              <h3 className="font-semibold text-lg mb-1">{currentPair[1].name}</h3>
              <p className="text-gray-600 text-sm mb-1">{currentPair[1].company}</p>
              <p className="text-blue-600 text-sm mb-2">{currentPair[1].username}</p>
              <p className="text-xs text-gray-500">Rating: {currentPair[1].rating}</p>
            </Card>
            {hasVotedOnCurrentPair && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                ✓ Voted
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        

        {/* Top 10 Rankings */}
        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#8B0000]">Top 10 Rankings</h2>
            <Link to="/rankings">
              <Button variant="outline" className="text-[#8B0000] border-[#8B0000] hover:bg-[#8B0000] hover:text-white">
                View Full Rankings
              </Button>
            </Link>
          </div>
          <div className="max-w-2xl mx-auto">
            {founders
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 10)
              .map((founder, index) => (
                <div key={founder.id} className="flex items-center justify-between p-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#8B0000] w-6">#{index + 1}</span>
                    <ImageKitImage
                      src={founder.image}
                      alt={founder.name}
                      className="w-12 h-12 face-crop-profile rounded-full"
                      loading="lazy"
                      transformation={[{
                        height: '48',
                        width: '48',
                        crop: 'maintain_ratio'
                      }]}
                    />
                    <div>
                      <p className="font-semibold">{founder.name}</p>
                      <p className="text-sm text-gray-600">{founder.company}</p>
                      <p className="text-xs text-blue-600">{founder.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{founder.rating}</p>
                    <p className="text-xs text-gray-500">{founder.votes} votes</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Developer Testing Panel (only show in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-12 max-w-md mx-auto">
            <details className="bg-gray-100 rounded-lg p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700 mb-2">
                🔧 Vote Queue Testing (Dev Only)
              </summary>
              <div className="space-y-2 text-xs">
                <div className="flex gap-2">
                  <Button
                    onClick={() => voteQueue.addTestVote()}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Add Test Vote
                  </Button>
                  <Button
                    onClick={() => voteQueue.forcSync()}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Force Sync
                  </Button>
                  <Button
                    onClick={() => voteQueue.clearQueue()}
                    variant="outline"
                    size="sm"
                    className="text-xs text-red-600"
                  >
                    Clear Queue
                  </Button>
                </div>
                <div className="text-gray-600 space-y-2">
                  <div>
                    <p>Queue: {voteQueue.getQueueStats().pendingVotes} votes</p>
                    <p>Processing: {voteQueue.getQueueStats().isProcessing ? 'Yes' : 'No'}</p>
                  </div>
                  
                  <div className="border-t pt-2">
                    <p className="font-semibold text-gray-700 mb-1">🖼️ ImageKit Testing</p>
                    <p>Sample Path: {getImageKitPath("nizzyabi")}</p>
                    <p>Local → ImageKit: {convertLocalToImageKit("/list/levelsio.jpg")}</p>
                    {currentPair && (
                      <p>Current pair images: ImageKit {currentPair[0].image.includes('/list/') ? '✅' : '❌'}</p>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-1">
                    • Votes cache locally and sync when you leave the page
                    • All images now load from ImageKit CDN
                    • Check console for queue activity logs
                  </p>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
