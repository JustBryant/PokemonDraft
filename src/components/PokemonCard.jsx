import React from 'react';

const TYPE_COLORS = {
  normal: 'bg-[#A8A77A]',
  fire: 'bg-[#EE8130]',
  water: 'bg-[#6390F0]',
  electric: 'bg-[#F7D02C]',
  grass: 'bg-[#7AC74C]',
  ice: 'bg-[#96D9D6]',
  fighting: 'bg-[#C22E28]',
  poison: 'bg-[#A33EA1]',
  ground: 'bg-[#E2BF65]',
  flying: 'bg-[#A98FF3]',
  psychic: 'bg-[#F95587]',
  bug: 'bg-[#A6B91A]',
  rock: 'bg-[#B6A136]',
  ghost: 'bg-[#735797]',
  dragon: 'bg-[#6F35FC]',
  dark: 'bg-[#705746]',
  steel: 'bg-[#B7B7CE]',
  fairy: 'bg-[#D685AD]',
};

export function PokemonCard({ pokemon, hidden }) {
  if (!pokemon) return null;

  return (
    <div className="relative group w-full">
      <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
      <div className="relative bg-slate-900 ring-1 ring-slate-700/50 rounded-2xl p-8 flex flex-col items-center">
        {hidden ? (
           <div className="w-48 h-48 flex items-center justify-center">
              <div className="w-32 h-32 bg-slate-800 rounded-full animate-pulse flex items-center justify-center">
                <span className="text-4xl font-black text-slate-700">?</span>
              </div>
           </div>
        ) : (
          <img 
            src={pokemon.image} 
            alt={pokemon.name} 
            className="w-48 h-48 object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform transition-transform group-hover:scale-110"
          />
        )}
        
        <div className="mt-6 text-center">
          <h3 className={`text-3xl font-black uppercase tracking-tighter ${hidden ? 'blur-md bg-slate-800 rounded' : ''}`}>
            {hidden ? 'Unknown' : pokemon.name}
          </h3>
          <div className="flex gap-2 mt-3 justify-center">
            {hidden ? (
               <div className="h-6 w-16 bg-slate-800 rounded-full animate-pulse"></div>
            ) : (
              (pokemon.types || [pokemon.type]).map(t => (
                <span 
                  key={t}
                  className={`${TYPE_COLORS[t.toLowerCase()] || 'bg-slate-700'} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm border border-white/10`}
                >
                  {t}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
