import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, X, ClipboardCheck, Sparkles, AlertCircle } from 'lucide-react';

export function HostSettings({ 
  onStartAuction, 
  onCancel, 
  startingMoney, 
  setStartingMoney, 
  isParticipating, 
  setIsParticipating,
  timerDuration = 30,
  setTimerDuration,
  startingBid = 0,
  setStartingBid,
  maxPokemon = 6,
  setMaxPokemon
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPokemon, setSelectedPokemon] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const searchPokemon = async () => {
    if (!searchTerm) return;
    setLoading(true);
    try {
      const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${searchTerm.toLowerCase().trim()}`);
      const data = response.data;
      setSearchResults([{
        id: data.id,
        name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
        image: data.sprites.other['official-artwork'].front_default,
        types: data.types.map(t => t.type.name),
        basePrice: startingBid
      }]);
    } catch (err) {
      alert('Pokemon not found!');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) return;
    setBulkLoading(true);
    const names = bulkInput.split(/[\n,]+/).map(n => n.trim().toLowerCase()).filter(n => n);
    const added = [];
    
    for (let name of names) {
      // Handle spaces for forms like "Hisuian Zoroark" -> "zoroark-hisuian"
      // PokeAPI uses hyphenated names for forms. Common ones:
      // "Hisuian X" -> "x-hisuian"
      // "Alolan X" -> "x-alolan"
      // "Galarian X" -> "x-galarian"
      // "Mega X" -> "x-mega"
      if (name.includes(' ')) {
        const parts = name.split(' ');
        if (parts.length === 2) {
          // Check if first word is a common prefix
          const prefixes = ['hisuian', 'alolan', 'galarian', 'mega', 'primal', 'origin'];
          if (prefixes.includes(parts[0])) {
            name = `${parts[1]}-${parts[0]}`;
          } else {
            // General fallback: swap and hyphenate
            name = parts.join('-');
          }
        }
      }

      if (selectedPokemon.some(p => p.name.toLowerCase() === name || p.name.toLowerCase() === name.replace('-', ' '))) continue;
      try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${name}`);
        const data = response.data;
        added.push({
          id: data.id,
          name: data.name.charAt(0).toUpperCase() + data.name.slice(1).replace('-', ' '),
          image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
          types: data.types.map(t => t.type.name),
          basePrice: startingBid
        });
      } catch (err) {
        console.warn(`Failed to find ${name}`);
      }
    }
    
    setSelectedPokemon(prev => [...prev, ...added]);
    setBulkInput('');
    setBulkLoading(false);
  };

  const addPokemon = (p) => {
    if (!selectedPokemon.find(item => item.id === p.id)) {
      setSelectedPokemon([...selectedPokemon, p]);
    }
  };

  const removePokemon = (id) => {
    setSelectedPokemon(selectedPokemon.filter(p => p.id !== id));
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl max-w-2xl w-full">
      <h2 className="text-3xl font-black mb-6 uppercase tracking-tight flex items-center gap-2">
        <ClipboardCheck className="text-yellow-500" /> Auction Setup
      </h2>

      <div className="space-y-6">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-yellow-500/20 mb-4 space-y-4">
          <label className="text-sm text-slate-400 mb-2 font-bold uppercase flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" /> Draft Settings
          </label>
          
          <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
            <div className="flex flex-col">
              <span className="text-sm font-bold uppercase">Host is Participating</span>
              <span className="text-[10px] text-slate-500 italic">Enable this to allow yourself to bid and draft Pokemon.</span>
            </div>
            <button 
              onClick={() => setIsParticipating(!isParticipating)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${isParticipating ? 'bg-yellow-500' : 'bg-slate-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isParticipating ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Starting Balance:</span>
            <input 
              type="number"
              value={startingMoney}
              onChange={(e) => setStartingMoney(parseInt(e.target.value) || 0)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white w-24 outline-none focus:ring-1 focus:ring-yellow-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Starting Bid:</span>
            <input 
              type="number"
              value={startingBid}
              onChange={(e) => setStartingBid(parseInt(e.target.value) || 0)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white w-24 outline-none focus:ring-1 focus:ring-yellow-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Max Pokemon:</span>
            <input 
              type="number"
              value={maxPokemon}
              onChange={(e) => setMaxPokemon(parseInt(e.target.value) || 0)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white w-24 outline-none focus:ring-1 focus:ring-yellow-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Turn Timer:</span>
              <span className="text-[10px] text-slate-500 italic">(seconds)</span>
            </div>
            <input 
              type="number"
              value={timerDuration}
              onChange={(e) => setTimerDuration(parseInt(e.target.value) || 0)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white w-24 outline-none focus:ring-1 focus:ring-yellow-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2 font-bold uppercase text-left">Add Pokemon to Pool</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onKeyDown={(e) => e.key === 'Enter' && searchPokemon()}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter Pokemon name (e.g. Lucario)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-10 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-3.5 text-slate-500 w-5 h-5" />
            </div>
            <button
              onClick={searchPokemon}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 px-6 rounded-xl font-bold disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="bg-slate-900/50 p-4 rounded-xl border border-blue-500/20">
            {searchResults.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={p.image} className="w-12 h-12 object-contain" alt="" />
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="text-xs text-slate-500 uppercase">{p.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => addPokemon(p)}
                  className="bg-green-600/20 hover:bg-green-600 text-green-500 hover:text-white p-2 rounded-lg transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-700 pt-6">
          <label className="text-sm text-slate-400 mb-2 font-bold uppercase flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" /> Bulk Add (Names separated by comma or newline)
          </label>
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="Pikachu, Eevee, Bulbasaur..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px] text-sm"
          />
          <button
            onClick={handleBulkAdd}
            disabled={bulkLoading || !bulkInput.trim()}
            className="w-full mt-2 bg-purple-600 hover:bg-purple-500 py-2 rounded-lg font-bold text-sm disabled:opacity-50 transition-all"
          >
            {bulkLoading ? 'Processing...' : 'Add Bulk List'}
          </button>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2 font-bold uppercase">Auction Pool ({selectedPokemon.length})</label>
          <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
            {selectedPokemon.map(p => (
              <div key={p.id} className="relative bg-slate-900 border border-slate-700 rounded-lg p-2 text-center group">
                <button
                  onClick={() => removePokemon(p.id)}
                  className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <img src={p.image} className="w-10 h-10 object-contain mx-auto" alt="" />
                <p className="text-[10px] truncate font-medium mt-1 uppercase">{p.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-700">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-xl font-bold"
          >
            Cancel
          </button>
          <button
            onClick={() => onStartAuction(selectedPokemon)}
            disabled={selectedPokemon.length === 0}
            className="flex-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-12 py-4 rounded-xl font-black uppercase text-lg shadow-lg shadow-yellow-500/10 disabled:opacity-50"
          >
            Start Draft
          </button>
        </div>

        <div className="mt-8 border-t border-red-500/20 pt-6">
          <button
            onClick={async () => {
              if (window.confirm('PERMANENTLY DELETE AUCTION? This will kick everyone and delete the database entry.')) {
                const { supabase } = await import('../lib/supabase');
                const roomId = window.location.pathname.split('/').pop();
                await supabase.from('rooms').delete().eq('id', roomId);
                window.location.href = '/';
              }
            }}
            className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-3 rounded-xl font-bold transition-all border border-red-500/20 flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" /> Destroy Auction
          </button>
          <p className="text-[10px] text-red-500/50 uppercase text-center mt-2 italic">DANGER: Immediate deletion of all data</p>
        </div>
      </div>
    </div>
  );
}
