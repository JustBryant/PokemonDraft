import React, { useState, useEffect } from 'react';
import { Settings, PlusCircle, MinusCircle, UserX } from 'lucide-react';

export function AdminPanel({ players, setPlayers, onKickPlayer }) {
  const [selectedPlayer, setSelectedPlayer] = useState(players[0]?.id || '');
  const [amount, setAmount] = useState(100);
  const [newName, setNewName] = useState('');

  // Auto-select first player if none selected or current gone
  useEffect(() => {
    if ((!selectedPlayer || !players.find(p => String(p.id) === String(selectedPlayer))) && players.length > 0) {
      setSelectedPlayer(players[0].id);
    }
  }, [players, selectedPlayer]);

  const adjustBalance = (delta) => {
    setPlayers(players.map(p => 
      String(p.id) === String(selectedPlayer) 
        ? { ...p, balance: Math.max(0, p.balance + delta) }
        : p
    ));
  };

  const renamePlayer = () => {
    if (!newName.trim()) return;
    setPlayers(players.map(p => 
      String(p.id) === String(selectedPlayer) 
        ? { ...p, name: newName }
        : p
    ));
    setNewName('');
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
      <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
        <Settings className="text-purple-400 w-5 h-5" /> Creator Dashboard
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Select Player</label>
          <select 
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none appearance-none cursor-pointer font-bold"
          >
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.isHost ? '(You)' : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Modify Career</label>
          <div className="flex gap-2 mb-4">
            <input 
              type="text"
              placeholder="New Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={renamePlayer}
              className="bg-blue-600 hover:bg-blue-500 px-4 rounded-xl text-sm font-black uppercase italic transition-all active:scale-95"
            >
              Rename
            </button>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-700/50">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Cash Adjustment</label>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => adjustBalance(amount)}
                className="bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black uppercase italic flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
              >
                <PlusCircle className="w-4 h-4" /> Add
              </button>
              <button 
                onClick={() => adjustBalance(-amount)}
                className="bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-black uppercase italic flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <MinusCircle className="w-4 h-4" /> Deduct
              </button>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <button 
                onClick={() => onKickPlayer(selectedPlayer)}
                className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-3 rounded-xl font-black uppercase italic transition-all flex items-center justify-center gap-2 border border-red-500/20"
              >
                <UserX className="w-4 h-4" /> Kick Player
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
