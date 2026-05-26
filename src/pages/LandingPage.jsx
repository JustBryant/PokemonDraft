import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Plus, Users, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LandingPage() {
  const navigate = useNavigate();

  // Cleanup old auctions on load
  useEffect(() => {
    const cleanup = async () => {
      try {
        // Delete rooms with no activity for more than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { error } = await supabase
          .from('rooms')
          .delete()
          .lt('last_activity_at', oneHourAgo);
        
        if (!error) console.log('[Purge] Cleaned up inactive rooms.');
      } catch (e) {
        console.error('Cleanup failed', e);
      }
    };
    cleanup();
  }, []);

  const createGame = () => {
    const roomId = Math.random().toString(36).substring(7);
    navigate(`/auction/${roomId}?host=true`, { 
      state: { 
        isHost: true, 
        playerName: 'Host'
      } 
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="inline-flex p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 mb-4">
          <Trophy className="w-12 h-12 text-yellow-500" />
        </div>
        
        <h1 className="text-5xl font-black tracking-tighter italic uppercase">
          Poke<span className="text-yellow-500 font-outline-2">Auction</span>
        </h1>
        
        <p className="text-slate-400 text-lg">
          The ultimate draft tool for you and your friends.
        </p>

        <div className="space-y-4 pt-8">
          <button
            onClick={createGame}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 group"
          >
            <Plus className="group-hover:rotate-90 transition-transform" />
            Create New Auction
          </button>
          <p className="text-sm text-slate-500">
            One click to start. Share the link with your friends!
          </p>
        </div>
      </div>
    </div>
  );
}
