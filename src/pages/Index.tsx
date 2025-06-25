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

import { foundersData } from '@/data/founders';

// Voting Stats Component
const VotingStats = () => {
  const [stats, setStats] = useState(rateLimiter.getVotingStats());

  useEffect(() => {
    const updateStats = () => {
      setStats(rateLimiter.getVotingStats());
    };

    // Update stats every 5 seconds
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-center gap-4 text-xs">
      <span>Your votes today: {stats.votesToday}/{stats.maxVotesPerDay}</span>
      <span>This hour: {stats.votesThisHour}/{stats.maxVotesPerHour}</span>
      <span>Unique pairs: {stats.uniquePairsVoted}</span>
    </div>
  );
};

// Using the real founders data

const Index = () => {
  const [founders, setFounders] = useState<Founder[]>([]);
  const [currentPair, setCurrentPair] = useState<[Founder, Founder] | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState<number>(0);

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

  // Load founders data - with Firebase fallback
  const loadFounders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting to load founders...');
      
      // Try Firebase first, but with quick timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 3000)
      );
      
             try {
         const existingFounders = await Promise.race([
           getFounders(),
           timeoutPromise
         ]) as Founder[];
         
         console.log('Firebase connected! Existing founders:', existingFounders.length);
         
         if (existingFounders.length === 0) {
           console.log('Database is empty, initializing with founder data...');
           // Try to initialize, but fall back if it fails
           try {
             const initialized = await initializeFounders(foundersData);
             console.log('Firebase initialized with', initialized.length, 'founders');
             setFounders(initialized);
           } catch (initError) {
             console.error('Failed to initialize Firebase:', initError);
             throw initError;
           }
         } else {
           console.log('Using existing Firebase data');
           setFounders(existingFounders);
         }
        
        // Try to get total votes, but don't fail if it doesn't work
        try {
          const votes = await getTotalVotes();
          setTotalVotes(votes);
        } catch (voteError) {
          console.log('Could not load total votes, starting from 0');
          setTotalVotes(0);
        }
        
      } catch (firebaseError) {
        console.log('Firebase unavailable, using local data:', firebaseError.message);
        throw firebaseError;
      }
      
    } catch (err) {
      console.log('Using fallback local data');
      // Fallback to local data with proper IDs
      const fallbackFounders = foundersData.map((f, index) => ({ 
        ...f, 
        id: `local-${index}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      setFounders(fallbackFounders);
      setTotalVotes(0);
    } finally {
      // Set initial random pair
      setTimeout(() => {
        if (founders.length >= 2) {
          setCurrentPair(getRandomPair(founders));
        } else {
          // Use the fallback data for initial pair
          const fallbackFounders = foundersData.map((f, index) => ({ 
            ...f, 
            id: `local-${index}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }));
          if (fallbackFounders.length >= 2) {
            setFounders(fallbackFounders);
            setCurrentPair(getRandomPair(fallbackFounders));
          }
        }
        setLoading(false);
      }, 100);
    }
  };

  // Handle vote
  const handleVote = async (winnerId: string, loserId: string) => {
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
      
      // Try to update Firebase, but don't fail if it's unavailable
      try {
        if (!winnerId.startsWith('local-')) {
          await Promise.all([
            updateFounderRatings(winnerId, loserId, newWinnerRating, newLoserRating),
            recordVote({
              winnerId,
              loserId,
              winnerName: winner.name,
              loserName: loser.name,
              browserId: rateLimiter.getBrowserId()
            })
          ]);
          
          console.log('Firebase updated successfully');
          
          // Reload founders data from Firebase to ensure we have latest ratings
          try {
            const updatedFounders = await getFounders();
            setFounders(updatedFounders);
          } catch (reloadError) {
            console.log('Could not reload from Firebase, using local updates');
          }
        } else {
          console.log('Using local mode - Firebase not available');
        }
      } catch (firebaseError) {
        console.error('Firebase update failed:', firebaseError);
        console.log('Continuing with local data only');
        // Continue with local updates only
      }
      
      // Update local state
      setFounders(prevFounders => {
        const updatedFounders = prevFounders.map(founder => {
          if (founder.id === winnerId) {
            return { ...founder, rating: newWinnerRating, votes: founder.votes + 1 };
          } else if (founder.id === loserId) {
            return { ...founder, rating: newLoserRating, votes: founder.votes + 1 };
          }
          return founder;
        });
        
        // Set new random pair from updated data
        setCurrentPair(getRandomPair(updatedFounders));
        return updatedFounders;
      });
      
      setTotalVotes(prev => prev + 1);
      
      // Clear any existing rate limit messages
      setRateLimitMessage(null);
      setCooldownTimer(0);
      
    } catch (err) {
      console.error('Error handling vote:', err);
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
          <h1 className="text-center text-2xl font-bold tracking-wider">HOTSMASH</h1>
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
              <img 
                src={currentPair[0].image} 
                alt={currentPair[0].name}
                className="w-48 h-64 face-crop rounded mb-4 mx-auto"
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
              <img 
                src={currentPair[1].image} 
                alt={currentPair[1].name}
                className="w-48 h-64 face-crop rounded mb-4 mx-auto"
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
        <div className="text-center text-gray-600 text-sm space-y-2">
          <p>Total Votes Cast: {totalVotes}</p>
          <VotingStats />
        </div>

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
                    <img 
                      src={founder.image} 
                      alt={founder.name}
                      className="w-12 h-12 face-crop-profile rounded-full"
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
      </div>
    </div>
  );
};

export default Index;
