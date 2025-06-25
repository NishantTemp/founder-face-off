import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Founder, getFounders } from '@/lib/firebaseService';
import { foundersData } from '@/data/founders';

const Rankings = () => {
  const [founders, setFounders] = useState<Founder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFounders = async () => {
    try {
      setLoading(true);
      setError(null);
      const foundersData = await getFounders();
      setFounders(foundersData);
    } catch (err) {
      console.error('Error loading founders:', err);
      setError('Failed to load rankings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFounders();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-[#8B0000] text-white py-4">
          <div className="container mx-auto px-4">
            <h1 className="text-center text-2xl font-bold tracking-wider">HOTSMASH - FULL RANKINGS</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#8B0000] mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Loading rankings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-[#8B0000] text-white py-4">
          <div className="container mx-auto px-4">
            <h1 className="text-center text-2xl font-bold tracking-wider">HOTSMASH - FULL RANKINGS</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadFounders} className="bg-[#8B0000] hover:bg-[#A00000]">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            {founders.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-600">No rankings available yet. Start voting to see results!</p>
                <Link to="/">
                  <Button className="mt-4 bg-[#8B0000] hover:bg-[#A00000]">
                    Start Voting
                  </Button>
                </Link>
              </div>
            ) : (
              founders
                .sort((a, b) => b.rating - a.rating)
                .map((founder, index) => (
                  <div key={founder.id} className="flex items-center justify-between p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-[#8B0000] w-8 text-lg">#{index + 1}</span>
                      <img 
                        src={founder.image} 
                        alt={founder.name}
                        className="w-16 h-16 face-crop-profile rounded-full"
                      />
                      <div>
                        <p className="font-semibold text-lg">{founder.name}</p>
                        <p className="text-gray-600">{founder.company}</p>
                        <p className="text-sm text-blue-600">{founder.username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{founder.rating}</p>
                      <p className="text-sm text-gray-500">{founder.votes} votes</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rankings;
