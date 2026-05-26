import React from 'react';
import { Users, Banknote, ShieldCheck, Trophy } from 'lucide-react';

export function PlayerList({ players, maxPokemon }) {
  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
      <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
        <Users className="text-blue-400 w-5 h-5" /> Trainers
      </h2>
      <div className="space-y-4">
        {players.map(player => {
          const isFinished = maxPokemon && player.party.length >= maxPokemon;
          
          return (
            <div key={player.id} className={`p-4 rounded-xl border transition-all ${
              isFinished 
                ? 'bg-green-900/20 border-green-500/50 grayscale-[0.3]' 
                : player.isHost 
                  ? 'bg-slate-900 border-yellow-500/30' 
                  : 'bg-slate-900/50 border-slate-700'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className={`font-black text-lg uppercase tracking-tight ${isFinished ? 'text-green-400' : ''}`}>
                    {player.name}
                  </span>
                  {player.isHost && (
                    <ShieldCheck className="w-4 h-4 text-yellow-500" title="Host" />
                  )}
                  {isFinished && (
                    <Trophy className="w-4 h-4 text-green-400" title="Finished" />
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="flex items-center gap-1 text-green-400 font-mono font-black text-sm bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                    <Banknote className="w-3.5 h-3.5" /> ${player.balance}
                  </span>
                  {maxPokemon && (
                    <span className={`text-[10px] font-black italic px-2 py-0.5 rounded-full border ${
                      isFinished ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-slate-700/50 border-slate-600 text-slate-400'
                    }`}>
                      PARTY: {player.party.length} / {maxPokemon}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
              {player.party.length === 0 ? (
                <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">No Pokemon</span>
              ) : (
                player.party.map((p, i) => {
                  if (!p) return null;
                  return (
                    <a 
                      key={i} 
                      href={`https://pokemondb.net/pokedex/${p.name.toLowerCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative"
                    >
                      <img 
                        src={p.image || p.sprite} 
                        alt={p.name} 
                        className="w-8 h-8 object-contain bg-slate-800 rounded-lg p-1 border border-slate-700 hover:scale-110 hover:border-blue-500 transition-all cursor-alias"
                        title={`${p.name} - View Pokedex`}
                      />
                    </a>
                  );
                })
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
