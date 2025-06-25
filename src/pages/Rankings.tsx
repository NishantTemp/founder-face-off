
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

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

const Rankings = () => {
  const [founders, setFounders] = useState<Founder[]>(sampleFounders);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#8B0000] text-white py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-center text-2xl font-bold tracking-wider">HOTSMASH - FULL RANKINGS</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <Link to="/">
            <Button variant="outline" className="text-[#8B0000] border-[#8B0000] hover:bg-[#8B0000] hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Voting
            </Button>
          </Link>
        </div>

        {/* Full Rankings */}
        <div>
          <h2 className="text-2xl font-bold text-center mb-6 text-[#8B0000]">Complete Leaderboard</h2>
          <div className="max-w-2xl mx-auto">
            {founders
              .sort((a, b) => b.rating - a.rating)
              .map((founder, index) => (
                <div key={founder.id} className="flex items-center justify-between p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-[#8B0000] w-8 text-lg">#{index + 1}</span>
                    <img 
                      src={founder.image} 
                      alt={founder.name}
                      className="w-16 h-16 object-cover rounded-full"
                    />
                    <div>
                      <p className="font-semibold text-lg">{founder.name}</p>
                      <p className="text-gray-600">{founder.company}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{founder.rating}</p>
                    <p className="text-sm text-gray-500">{founder.votes} votes</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rankings;
