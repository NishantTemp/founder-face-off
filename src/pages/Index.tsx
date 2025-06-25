
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Founder {
  id: number;
  name: string;
  company: string;
  image: string;
  rating: number;
  votes: number;
}

const sampleFounders: Founder[] = [
  {
    id: 1,
    name: "Elon Musk",
    company: "Tesla, SpaceX",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=400&fit=crop&crop=face",
    rating: 1200,
    votes: 0
  },
  {
    id: 2,
    name: "Mark Zuckerberg",
    company: "Meta",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=400&fit=crop&crop=face",
    rating: 1200,
    votes: 0
  },
  {
    id: 3,
    name: "Jeff Bezos",
    company: "Amazon",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop&crop=face",
    rating: 1200,
    votes: 0
  },
  {
    id: 4,
    name: "Tim Cook",
    company: "Apple",
    image: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=300&h=400&fit=crop&crop=face",
    rating: 1200,
    votes: 0
  },
  {
    id: 5,
    name: "Satya Nadella",
    company: "Microsoft",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=400&fit=crop&crop=face",
    rating: 1200,
    votes: 0
  },
  {
    id: 6,
    name: "Reid Hoffman",
    company: "LinkedIn",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=400&fit=crop&crop=face",
    rating: 1200,
    votes: 0
  },
  {
    id: 7,
    name: "Drew Houston",
    company: "Dropbox",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=400&fit=crop&crop=face",
    rating: 1200,
    votes: 0
  },
  {
    id: 8,
    name: "Brian Chesky",
    company: "Airbnb",
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&h=400&fit=crop&crop=face",
    rating: 1200,
    votes: 0
  }
];

const Index = () => {
  const [founders, setFounders] = useState<Founder[]>(sampleFounders);
  const [currentPair, setCurrentPair] = useState<[Founder, Founder] | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);

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
  const getRandomPair = (): [Founder, Founder] => {
    const shuffled = [...founders].sort(() => 0.5 - Math.random());
    return [shuffled[0], shuffled[1]];
  };

  // Handle vote
  const handleVote = (winnerId: number, loserId: number) => {
    setFounders(prevFounders => {
      const updatedFounders = prevFounders.map(founder => {
        if (founder.id === winnerId) {
          const winner = founder;
          const loser = prevFounders.find(f => f.id === loserId)!;
          const { newWinnerRating } = calculateEloRating(winner.rating, loser.rating);
          return { ...founder, rating: newWinnerRating, votes: founder.votes + 1 };
        } else if (founder.id === loserId) {
          const loser = founder;
          const winner = prevFounders.find(f => f.id === winnerId)!;
          const { newLoserRating } = calculateEloRating(winner.rating, loser.rating);
          return { ...founder, rating: newLoserRating, votes: founder.votes + 1 };
        }
        return founder;
      });
      return updatedFounders;
    });
    
    setTotalVotes(prev => prev + 1);
    setCurrentPair(getRandomPair());
  };

  // Initialize with random pair
  useEffect(() => {
    setCurrentPair(getRandomPair());
  }, []);

  if (!currentPair) {
    return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
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
          <p className="text-gray-700 mb-2">
            Were we let in for our looks? No. Will we be judged on them? Yes.
          </p>
          <p className="text-gray-900 font-semibold text-lg">
            Who's Hotter? Click to Choose.
          </p>
        </div>

        {/* Voting Interface */}
        <div className="flex flex-col md:flex-row gap-8 items-center justify-center mb-8">
          {/* Left Founder */}
          <div className="text-center">
            <Card className="p-4 cursor-pointer hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-[#8B0000]"
                  onClick={() => handleVote(currentPair[0].id, currentPair[1].id)}>
              <img 
                src={currentPair[0].image} 
                alt={currentPair[0].name}
                className="w-48 h-64 object-cover rounded mb-4 mx-auto"
              />
              <h3 className="font-semibold text-lg mb-1">{currentPair[0].name}</h3>
              <p className="text-gray-600 text-sm mb-2">{currentPair[0].company}</p>
              <p className="text-xs text-gray-500">Rating: {currentPair[0].rating}</p>
            </Card>
          </div>

          {/* VS */}
          <div className="text-center">
            <span className="text-4xl font-bold text-[#8B0000]">VS</span>
          </div>

          {/* Right Founder */}
          <div className="text-center">
            <Card className="p-4 cursor-pointer hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-[#8B0000]"
                  onClick={() => handleVote(currentPair[1].id, currentPair[0].id)}>
              <img 
                src={currentPair[1].image} 
                alt={currentPair[1].name}
                className="w-48 h-64 object-cover rounded mb-4 mx-auto"
              />
              <h3 className="font-semibold text-lg mb-1">{currentPair[1].name}</h3>
              <p className="text-gray-600 text-sm mb-2">{currentPair[1].company}</p>
              <p className="text-xs text-gray-500">Rating: {currentPair[1].rating}</p>
            </Card>
          </div>
        </div>

        {/* Stats */}
        <div className="text-center text-gray-600 text-sm">
          <p>Total Votes Cast: {totalVotes}</p>
        </div>

        {/* Rankings */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-center mb-6 text-[#8B0000]">Current Rankings</h2>
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
                      className="w-12 h-12 object-cover rounded-full"
                    />
                    <div>
                      <p className="font-semibold">{founder.name}</p>
                      <p className="text-sm text-gray-600">{founder.company}</p>
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
