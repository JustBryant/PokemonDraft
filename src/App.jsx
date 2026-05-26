import React, { useState, useEffect } from 'react';
import { PokemonCard } from './components/PokemonCard';
import { PlayerList } from './components/PlayerList';
import { AdminPanel } from './components/AdminPanel';
import { Trophy, Users, Banknote, Play, Square } from 'lucide-react';

// Mock data for initial state
const INITIAL_PLAYERS = [
  { id: 1, name: 'Player 1', balance: 1000, party: [] },
  { id: 2, name: 'Player 2', balance: 1000, party: [] },
  { id: 3, name: 'Player 3', balance: 1000, party: [] },
  { id: 4, name: 'Player 4', balance: 1000, party: [] },
  { id: 5, name: 'Player 5', balance: 1000, party: [] },
  { id: 6, name: 'Player 6', balance: 1000, party: [] },
  { id: 7, name: 'Player 7', balance: 1000, party: [] },
  { id: 8, name: 'Player 8', balance: 1000, party: [] },
];

const INITIAL_POKEMON = [
  { id: 25, name: 'Pikachu', type: 'Electric', image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png', basePrice: 100 },
  { id: 6, name: 'Charizard', type: 'Fire/Flying', image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png', basePrice: 200 },
  { id: 9, name: 'Blastoise', type: 'Water', image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/9.png', basePrice: 200 },
  { id: 3, name: 'Venusaur', type: 'Grass/Poison', image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/3.png', basePrice: 200 },
  { id: 150, name: 'Mewtwo', type: 'Psychic', image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png', basePrice: 500 },
  { id: 143, name: 'Snorlax', type: 'Normal', image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/143.png', basePrice: 150 },
  { id: 131, name: 'Lapras', type: 'Water/Ice', image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/131.png', basePrice: 150 },
  { id: 94, name: 'Gengar', type: 'Ghost/Poison', image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png', basePrice: 150 },
];

function App() {
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [currentPokemon, setCurrentPokemon] = useState(INITIAL_POKEMON[0]);
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [isBiddingActive, setIsBiddingActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true); // Toggle for demo
  const [history, setHistory] = useState([]);

  const handleBid = (playerId, amount) => {
    if (!isBiddingActive) return;
    const player = players.find(p => p.id === playerId);
    if (player.balance < amount) return;
    if (amount <= currentBid) return;

    setCurrentBid(amount);
    setHighestBidder(player);
  };

  const startAuction = () => {
    setIsBiddingActive(true);
    setCurrentBid(currentPokemon.basePrice);
    setHighestBidder(null);
  };

  const endAuction = () => {
    setIsBiddingActive(false);
    if (highestBidder) {
      // Update player balance and party
      setPlayers(players.map(p => 
        p.id === highestBidder.id 
          ? { ...p, balance: p.balance - currentBid, party: [...p.party, currentPokemon] }
          : p
      ));
      setHistory([{ pokemon: currentPokemon, winner: highestBidder, price: currentBid }, ...history]);
      
      // Move to next pokemon (simplistic for demo)
      const currentIndex = INITIAL_POKEMON.findIndex(p => p.id === currentPokemon.id);
      if (currentIndex < INITIAL_POKEMON.length - 1) {
        setCurrentPokemon(INITIAL_POKEMON[currentIndex + 1]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="text-yellow-400" /> PokeAuction
        </h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsAdmin(!isAdmin)}
            className="text-xs text-slate-400 hover:text-white underline"
          >
            Switch to {isAdmin ? 'Player' : 'Admin'} View
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Player Stats */}
        <div className="lg:col-span-1 space-y-6">
          <PlayerList players={players} />
        </div>

        {/* Middle Column: Current Bidding */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Play className="text-green-400 w-5 h-5" /> Current Auction
            </h2>
            
            <PokemonCard pokemon={currentPokemon} />

            <div className="mt-6 p-4 bg-slate-900 rounded-lg border border-slate-700 text-center">
              <p className="text-slate-400 text-sm uppercase tracking-wider">Current Bid</p>
              <p className="text-4xl font-bold text-yellow-400">${currentBid}</p>
              {highestBidder && (
                <p className="text-green-400 font-medium mt-1">
                  Highest Bidder: {highestBidder.name}
                </p>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              {!isBiddingActive && isAdmin && (
                <button 
                  onClick={startAuction}
                  className="col-span-2 bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold transition-colors"
                >
                  Start Bidding
                </button>
              )}
              {isBiddingActive && (
                <>
                  <button 
                    onClick={() => handleBid(1, currentBid + 10)}
                    disabled={players[0].balance < currentBid + 10}
                    className="bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    Bid +$10
                  </button>
                  <button 
                    onClick={() => handleBid(1, currentBid + 50)}
                    disabled={players[0].balance < currentBid + 50}
                    className="bg-blue-700 hover:bg-blue-600 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    Bid +$50
                  </button>
                </>
              )}
              {isBiddingActive && isAdmin && (
                <button 
                  onClick={endAuction}
                  className="col-span-2 bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold transition-colors mt-4"
                >
                  End Bidding
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: History & Misc */}
        <div className="lg:col-span-1 space-y-6">
          {isAdmin && (
            <AdminPanel 
              players={players} 
              setPlayers={setPlayers}
            />
          )}

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Recent Sales</h2>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-slate-500 italic">No sales yet</p>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                    <span className="font-medium">{h.pokemon.name}</span>
                    <span className="text-slate-400">Sold to {h.winner.name} for <span className="text-yellow-400">${h.price}</span></span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
