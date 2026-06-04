import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Share2, Users, Banknote, Play, Square, Settings, Link as LinkIcon, UserPlus, Radio, Download, ExternalLink, Zap } from 'lucide-react';
import { PokemonCard } from '../components/PokemonCard';
import { PlayerList } from '../components/PlayerList';
import { AdminPanel } from '../components/AdminPanel';
import { HostSettings } from '../components/HostSettings';
import { supabase, isSupabaseConfigured, db } from '../lib/supabase';

/**
 * AuctionRoom - Main game engine for Pokemon Auctions.
 * Corrected to fix React Hook ordering (Error #310) and sync issues.
 */
export default function AuctionRoom() {
  const { id: roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // ==========================================
  // 1. ALL REACT HOOKS (Must remain at top level)
  // ==========================================

  // --- STATE HOOKS ---
  const [roomState, setRoomState] = useState(() => {
    const isForcedNew = new URLSearchParams(window.location.search).get('new_player') === 'true';
    const urlParams = new URLSearchParams(window.location.search);
    const hostFromUrl = urlParams.get('host') === 'true';
    const saved = !isForcedNew ? localStorage.getItem(`poke_session_${roomId}`) : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (window.location.search && !isForcedNew) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      return parsed;
    }
    if (location.state) {
      localStorage.setItem(`poke_session_${roomId}`, JSON.stringify(location.state));
      return location.state;
    }
    return { isHost: hostFromUrl, playerName: '', startingMoney: 1000 };
  });

  const [players, setPlayers] = useState([]);
  const [pokemonPool, setPokemonPool] = useState([]);
  const [currentPokemonIndex, setCurrentPokemonIndex] = useState(-1);
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [isBiddingActive, setIsBiddingActive] = useState(false);
  const [history, setHistory] = useState([]);
  const [nominationOrder, setNominationOrder] = useState([]);
  const [currentNomineeIndex, setCurrentNomineeIndex] = useState(0);
  const [timerDuration, setTimerDuration] = useState(30);
  const [maxPokemon, setMaxPokemon] = useState(6);
  const [isDraftFinalized, setIsDraftFinalized] = useState(false);
  const [startingBid, setStartingBid] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isParticipating, setIsParticipating] = useState(roomState.isParticipating || false);
  const [biddersInRound, setBiddersInRound] = useState([]);
  const [isConnectionLoading, setIsConnectionLoading] = useState(isSupabaseConfigured);
  const [isAuctionStarted, setIsAuctionStarted] = useState(false);
  const [showHostSetup, setShowHostSetup] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [hasJoined, setHasJoined] = useState(() => {
    if (roomState.playerName) return true;
    if (roomState.isHost && (location.state?.isHost)) return true;
    return false;
  });
  const [tempName, setTempName] = useState('');
  const [currentBidderIndex, setCurrentBidderIndex] = useState(0);
  const [isSnakeDescending, setIsSnakeDescending] = useState(true);
  const [actualRound, setActualRound] = useState(1);
  const [showWinCeremony, setShowWinCeremony] = useState(false);
  const [lastWinData, setLastWinData] = useState(null);

  // --- MEMO HOOKS ---
  const currentPokemon = useMemo(() => {
    return currentPokemonIndex >= 0 ? pokemonPool[currentPokemonIndex] : null;
  }, [currentPokemonIndex, pokemonPool]);

  const canHostFinish = useMemo(() => {
    if (!isAuctionStarted || isDraftFinalized) return false;
    const poolExhausted = pokemonPool.length > 0 && history.length >= pokemonPool.length;
    return poolExhausted;
  }, [isAuctionStarted, isDraftFinalized, pokemonPool.length, history.length]);

  // --- EFFECT HOOKS ---
  
  // 1. Setup toggle
  useEffect(() => {
    if (roomState.isHost) {
      if (isAuctionStarted || pokemonPool.length > 0) setShowHostSetup(false);
      else setShowHostSetup(true);
    }
  }, [isAuctionStarted, roomState.isHost, pokemonPool.length]);

  // 2. Global handlers
  useEffect(() => {
    window.handleBackToRoom = () => {
       setIsDraftFinalized(false);
       if (roomState.isHost) {
         updateRoomState({ is_finalized: false });
       }
    };
  }, [roomId, roomState.isHost]);

  // 3. Main Bidding Timer
  useEffect(() => {
    if (!roomState.isHost || !isBiddingActive) {
      if (!isBiddingActive) setTimeLeft(timerDuration);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
           const pName = players[currentBidderIndex]?.name;
           if (pName) triggerAutoSkip(pName);
        }
        updateRoomState({ time_left: next });
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isBiddingActive, roomState.isHost, currentBidderIndex, timerDuration, players]);

  // 4. Supabase & Broadcast Sync
  useEffect(() => {
    if (!roomId) return;
    const channel = new BroadcastChannel(`poke_auction_${roomId}`);
    
    const updateLocalState = (data) => {
      if (!data) return;
      if (data.participants) setPlayers(data.participants);
      if (data.pool) setPokemonPool(data.pool);
      if (data.current_index !== undefined) setCurrentPokemonIndex(data.current_index);
      if (data.current_bid !== undefined) setCurrentBid(data.current_bid);
      if (data.highest_bidder !== undefined) setHighestBidder(data.highest_bidder);
      if (data.is_active !== undefined) setIsBiddingActive(data.is_active);
      if (data.is_started !== undefined) setIsAuctionStarted(data.is_started);
      if (data.history) setHistory(data.history);
      if (data.nomination_order) setNominationOrder(data.nomination_order);
      if (data.nominee_index !== undefined) setCurrentNomineeIndex(data.nominee_index);
      if (data.is_descending !== undefined) setIsSnakeDescending(data.is_descending);
      if (data.actual_round !== undefined) setActualRound(data.actual_round);
      if (data.starting_bid !== undefined) setStartingBid(data.starting_bid);
      if (data.timer_duration !== undefined) setTimerDuration(data.timer_duration);
      if (data.max_pokemon !== undefined) setMaxPokemon(data.max_pokemon);
      if (data.time_left !== undefined) setTimeLeft(data.time_left);
      if (data.is_finalized !== undefined) setIsDraftFinalized(data.is_finalized);
      if (data.starting_money !== undefined) {
        setRoomState(prev => prev.startingMoney === data.starting_money ? prev : ({ ...prev, startingMoney: data.starting_money }));
      }
    };

    channel.onmessage = (e) => {
      if (e.data.type === 'STATE_UPDATE') updateLocalState(e.data.data);
    };

    const loadingTimeout = setTimeout(() => setIsConnectionLoading(false), 8000);

    let supabaseChannel = null;
    if (isSupabaseConfigured) {
      const init = async () => {
        try {
          const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
          if (data) updateLocalState(data);
          else if (error && roomState.isHost) {
            await supabase.from('rooms').insert([{ id: roomId, host_id: roomState.playerName || 'Host', participants: [], pool: [], is_started: false }]);
          }
        } finally {
          setIsConnectionLoading(false);
          clearTimeout(loadingTimeout);
        }
      };
      init();

      supabaseChannel = supabase.channel(`room:${roomId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (p) => {
        if (p.new) updateLocalState(p.new);
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR') {
          setIsConnectionLoading(false);
          clearTimeout(loadingTimeout);
        }
      });
    } else {
      setIsConnectionLoading(false);
      clearTimeout(loadingTimeout);
    }

    return () => {
      channel.close();
      if (supabaseChannel) supabase.removeChannel(supabaseChannel);
      clearTimeout(loadingTimeout);
    };
  }, [roomId, isSupabaseConfigured, roomState.isHost]);

  // 5. Participation Sync (Host Only)
  useEffect(() => {
    if (roomState.isHost && hasJoined) {
      const existingIdx = players.findIndex(p => p.name === roomState.playerName);
      if (isParticipating && existingIdx === -1) {
        const newPlayer = { id: 'host', name: roomState.playerName || 'Host', balance: roomState.startingMoney || 1000, party: [], isHost: true };
        updateRoomState({ participants: [...players, newPlayer] });
      } else if (!isParticipating && existingIdx !== -1) {
        updateRoomState({ participants: players.filter(p => p.id !== 'host') });
      }
    }
  }, [isParticipating, hasJoined, roomState.isHost]);

  // ==========================================
  // 2. HELPER FUNCTIONS
  // ==========================================

  const updateRoomState = async (updates) => {
    try {
      const bc = new BroadcastChannel(`poke_auction_${roomId}`);
      bc.postMessage({ type: 'STATE_UPDATE', data: updates });
      bc.close();
    } catch (e) {}

    // Apply locally for responsive feel
    if (updates.participants) setPlayers(updates.participants);
    if (updates.pool) setPokemonPool(updates.pool);
    if (updates.current_index !== undefined) setCurrentPokemonIndex(updates.current_index);
    if (updates.current_bid !== undefined) setCurrentBid(updates.current_bid);
    if (updates.highest_bidder !== undefined) setHighestBidder(updates.highest_bidder);
    if (updates.is_active !== undefined) setIsBiddingActive(updates.is_active);
    if (updates.is_started !== undefined) setIsAuctionStarted(updates.is_started);
    if (updates.history) setHistory(updates.history);
    if (updates.nominee_index !== undefined) setCurrentNomineeIndex(updates.nominee_index);
    if (updates.time_left !== undefined) setTimeLeft(updates.time_left);
    if (updates.is_finalized !== undefined) setIsDraftFinalized(updates.is_finalized);

    if (isSupabaseConfigured) {
      await db.update('rooms', roomId, { ...updates, last_activity_at: new Date().toISOString() });
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const cleanName = tempName.trim();
    if (!cleanName) return;
    const newState = { ...roomState, playerName: cleanName };
    setRoomState(newState);
    localStorage.setItem(`poke_session_${roomId}`, JSON.stringify(newState));
    setHasJoined(true);
    const existing = players.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    if (!existing) {
      const newPlayer = { id: `${Date.now()}`, name: cleanName, balance: roomState.startingMoney || 1000, party: [], isHost: false };
      updateRoomState({ participants: [...players, newPlayer] });
    }
  };

  const handleBid = (multiplier) => {
    if (players[currentBidderIndex]?.name !== roomState.playerName && !roomState.isHost) return;
    const amount = currentBid + multiplier;
    const me = players.find(p => p.name === roomState.playerName);
    if (!me || me.balance < amount || !isBiddingActive) return;

    let nextIdx = (currentBidderIndex + 1) % players.length;
    // Find next person in round (simplified for now)
    updateRoomState({ current_bid: amount, highest_bidder: me, bidder_index: nextIdx, time_left: timerDuration });
  };

  const handleSkip = () => {
    if (players[currentBidderIndex]?.name !== roomState.playerName && !roomState.isHost) return;
    // Basic skip: rotate turn
    let nextIdx = (currentBidderIndex + 1) % players.length;
    updateRoomState({ bidder_index: nextIdx, time_left: timerDuration });
  };

  const triggerAutoSkip = (name) => {
    console.log("Auto-skipping", name);
    handleSkip();
  };

  const finalizeSale = async (winner, price, index) => {
    const poke = pokemonPool[index];
    const updatedPlayers = players.map(p => p.name === winner.name ? { ...p, balance: p.balance - price, party: [...p.party, poke] } : p);
    const newHist = [{ pokemon: poke, winner, price }, ...history];
    
    // SNAKE DRAFT LOGIC FOR NEXT NOMINATION
    let nextNomineeIdx = currentNomineeIndex;
    let nextDescending = isSnakeDescending;
    let nextRound = actualRound;

    if (nextDescending) {
      if (currentNomineeIndex >= nominationOrder.length - 1) {
        nextDescending = false;
        nextRound++;
        // On turnaround, we stay at the same index if they can nominate, 
        // but the current implementation usually moves. 
        // Let's stick to the user's previous logic:
      } else {
        nextNomineeIdx++;
      }
    } else {
      if (currentNomineeIndex <= 0) {
        nextDescending = true;
        nextRound++;
      } else {
        nextNomineeIdx--;
      }
    }

    // Check if the next person is maxed out
    const anyoneHasMoney = updatedPlayers.some(p => p.balance > 0 && p.party.length < maxPokemon);
    
    let safety = 0;
    while (safety < nominationOrder.length * 2) {
      const candidateName = nominationOrder[nextNomineeIdx];
      const candidate = updatedPlayers.find(p => p.name === candidateName);
      
      const hasSpace = candidate && candidate.party.length < maxPokemon;
      const hasMoney = candidate && candidate.balance > 0;

      const canProceed = anyoneHasMoney ? (hasMoney && hasSpace) : hasSpace;
      if (canProceed) break;

      if (nextDescending) {
        if (nextNomineeIdx >= nominationOrder.length - 1) {
          nextDescending = false;
          nextRound++;
          nextNomineeIdx = Math.max(0, nextNomineeIdx - 1);
        } else nextNomineeIdx++;
      } else {
        if (nextNomineeIdx <= 0) {
          nextDescending = true;
          nextRound++;
          nextNomineeIdx = Math.min(nominationOrder.length - 1, nextNomineeIdx + 1);
        } else nextNomineeIdx--;
      }
      safety++;
    }

    updateRoomState({
      participants: updatedPlayers,
      history: newHist,
      is_active: false,
      current_index: -1,
      nominee_index: nextNomineeIdx,
      is_descending: nextDescending,
      actual_round: nextRound,
      win_ceremony: { winner: winner.name, price, pokemon: poke.name, image: poke.image || poke.sprite }
    });
    
    setLastWinData({ winner: winner.name, price, pokemon: poke.name, image: poke.image || poke.sprite });
    setShowWinCeremony(true);
    setTimeout(() => setShowWinCeremony(false), 4000);
  };

  const nominatePokemon = (idx) => {
    const nomineeName = nominationOrder[currentNomineeIndex];
    if (nomineeName !== roomState.playerName && !roomState.isHost) return;
    
    const nominee = players.find(p => p.name === nomineeName);
    const anyoneHasMoney = players.some(p => p.balance > 0 && p.party.length < maxPokemon);

    if (nominee) {
      if (nominee.party.length >= maxPokemon) return;
      if (anyoneHasMoney && nominee.balance <= 0) return;
    }

    const activeBidders = players
      .filter(p => p.balance > 0 && p.party.length < maxPokemon)
      .map(p => p.name);
    
    const initialPrice = (nominee && nominee.balance <= 0) ? 0 : startingBid;
    
    // Check if anyone else can bid
    const othersCanBid = anyoneHasMoney && players.some(p => 
      p.name !== nomineeName && p.balance > initialPrice && p.party.length < maxPokemon
    );

    if (!othersCanBid) {
      finalizeSale(nominee || players[0], anyoneHasMoney ? initialPrice : 0, idx);
      return;
    }

    const nomineeIdx = players.findIndex(p => p.name === nomineeName);
    let nextBidderIdx = (nomineeIdx + 1) % players.length;
    let safety = 0;
    while (safety < players.length) {
      if (activeBidders.includes(players[nextBidderIdx].name) && players[nextBidderIdx].name !== nomineeName) break;
      nextBidderIdx = (nextBidderIdx + 1) % players.length;
      safety++;
    }

    updateRoomState({
      current_index: idx,
      current_bid: initialPrice,
      is_active: true,
      highest_bidder: nominee,
      bidders_in_round: [nomineeName, ...activeBidders].filter((v, i, a) => a.indexOf(v) === i),
      bidder_index: nextBidderIdx,
      time_left: timerDuration
    });
  };

  // ==========================================
  // 3. RENDERERS
  // ==========================================

  if (isConnectionLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-bold uppercase tracking-widest text-slate-400">Connecting...</p>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <form onSubmit={handleJoin} className="bg-slate-800 p-8 rounded-3xl border border-slate-700 w-full max-w-sm space-y-6">
          <h2 className="text-2xl font-black italic uppercase text-center">Join Room</h2>
          <input autoFocus required type="text" placeholder="Trainer Name" value={tempName} onChange={e => setTempName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500" />
          <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black uppercase transition-all">Enter Auction</button>
        </form>
      </div>
    );
  }

  if (showHostSetup && roomState.isHost && !isAuctionStarted) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <HostSettings 
          onStartAuction={(pool) => updateRoomState({ pool, is_started: true, is_active_game: false })} 
          onCancel={() => navigate('/')}
          startingMoney={roomState.startingMoney}
          setStartingMoney={v => updateRoomState({ starting_money: v })}
          isParticipating={isParticipating}
          setIsParticipating={setIsParticipating}
          timerDuration={timerDuration}
          setTimerDuration={v => updateRoomState({ timer_duration: v })}
          startingBid={startingBid}
          setStartingBid={v => updateRoomState({ starting_bid: v })}
          maxPokemon={maxPokemon}
          setMaxPokemon={v => updateRoomState({ max_pokemon: v })}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 lg:p-8">
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
          <Trophy className="text-yellow-400 w-8 h-8" />
          <h1 className="text-3xl font-black italic uppercase">Poke<span className="text-yellow-500">Auction</span></h1>
        </div>
        <div className="flex gap-3">
          {canHostFinish && roomState.isHost && <button onClick={() => updateRoomState({ is_finalized: true })} className="bg-yellow-500 text-slate-900 px-6 py-2 rounded-xl font-bold uppercase">Finish</button>}
          <button onClick={() => setShowPoolModal(true)} className="bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold border border-slate-700">View Pool</button>
          {roomState.isHost && <button onClick={() => setShowAdmin(!showAdmin)} className="p-2 bg-slate-800 rounded-xl border border-slate-700"><Settings /></button>}
        </div>
      </header>

      {/* MAIN GAME */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1"><PlayerList players={players} maxPokemon={maxPokemon} /></div>
        
        <div className="lg:col-span-2">
          {!isAuctionStarted ? (
            <div className="bg-slate-800 rounded-[2.5rem] p-12 text-center border border-slate-700 space-y-6">
              <Trophy className="w-16 h-16 text-blue-500 mx-auto animate-bounce" />
              <h2 className="text-4xl font-black italic uppercase">Waiting for Host</h2>
              <p className="text-slate-400">{players.length} Trainers in the lobby</p>
              {roomState.isHost && pokemonPool.length > 0 && (
                <button onClick={() => {
                  const names = players.map(p => p.name).sort(() => Math.random() - 0.5);
                  updateRoomState({ is_active_game: true, nomination_order: names, nominee_index: 0 });
                }} className="bg-yellow-500 text-slate-900 px-10 py-5 rounded-2xl font-black uppercase text-xl scale-105 transition-all">Start Draft</button>
              )}
            </div>
          ) : currentPokemon ? (
            <div className="bg-slate-800 rounded-[2.5rem] p-10 border border-slate-700 flex flex-col items-center">
              <PokemonCard pokemon={currentPokemon} />
              <div className="w-full mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-700">
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Highest Bid</p>
                  <p className="text-7xl font-black text-yellow-500">${currentBid}</p>
                  {highestBidder && <p className="text-green-400 font-bold mt-2">{highestBidder.name}</p>}
                </div>
                <div className="space-y-4">
                  {isBiddingActive ? (
                    <>
                      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700 flex justify-between px-6">
                        <div className="text-left"><p className="text-[10px] text-slate-500 font-bold">TURN</p><p className="font-black text-yellow-500 uppercase italic">{players[currentBidderIndex]?.name === roomState.playerName ? 'YOU' : players[currentBidderIndex]?.name}</p></div>
                        <div className="text-right"><p className="text-[10px] text-slate-500 font-bold">TIME</p><p className={`text-2xl font-black ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : ''}`}>{timeLeft}s</p></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleBid(50)} className="bg-blue-600 h-20 rounded-2xl font-black text-2xl">+$50</button>
                        <button onClick={() => handleBid(100)} className="bg-indigo-600 h-20 rounded-2xl font-black text-2xl">+$100</button>
                        <button onClick={handleSkip} className="col-span-2 bg-red-600/20 border border-red-500 text-red-500 py-4 rounded-2xl font-black">SKIP</button>
                        {roomState.isHost && <button onClick={() => finalizeSale(highestBidder, currentBid, currentPokemonIndex)} className="col-span-2 bg-green-600 py-3 rounded-2xl font-black mt-2">FORCED WIN (HOST ONLY)</button>}
                      </div>
                    </>
                  ) : <p className="p-10 italic text-slate-500">Processing...</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-[2.5rem] p-8 border border-slate-700">
              <h2 className="text-2xl font-black uppercase italic mb-6">Nominations: {nominationOrder[currentNomineeIndex]}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {pokemonPool.map((p, idx) => {
                  const drafted = history.some(h => h.pokemon && h.pokemon.id === p.id);
                  return (
                    <button key={p.id} disabled={drafted} onClick={() => nominatePokemon(idx)} className={`p-2 rounded-xl bg-slate-900 border ${drafted ? 'opacity-30' : 'border-slate-700 hover:border-blue-500'}`}>
                      <img src={p.sprite || p.image} alt="" className="w-full" />
                      <p className="text-[10px] font-black uppercase truncate mt-2">{p.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          {showAdmin && <AdminPanel players={players} setPlayers={setPlayers} onKickPlayer={id => updateRoomState({ participants: players.filter(p => p.id !== id) })} />}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-bold border-b border-slate-700 pb-3 mb-4 uppercase">History</h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="bg-slate-900 p-2 rounded-xl flex items-center justify-between gap-3 border border-slate-700/50">
                   <img src={h.pokemon?.image} className="w-10" alt="" />
                   <div className="flex-1 min-w-0 text-sm font-bold uppercase">{h.pokemon?.name}</div>
                   <div className="text-yellow-500 font-bold">${h.price}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {showPoolModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border-2 border-slate-700 rounded-[3rem] w-full max-w-4xl p-8 max-h-[80vh] overflow-hidden flex flex-col">
            <h2 className="text-3xl font-black italic uppercase mb-6">Pokemon Pool</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 overflow-y-auto pr-4 custom-scrollbar">
              {pokemonPool.map(p => (
                <div key={p.id} className={`p-2 bg-slate-900 rounded-2xl border border-slate-700 text-center ${history.some(h => h.pokemon?.id === p.id) ? 'opacity-30' : ''}`}>
                  <img src={p.sprite || p.image} className="w-full" alt="" />
                  <p className="text-[8px] font-black uppercase truncate">{p.name}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowPoolModal(false)} className="mt-8 bg-blue-600 py-3 rounded-2xl font-black uppercase">Close</button>
          </div>
        </div>
      )}

      {showWinCeremony && <WinCeremony data={lastWinData} />}
      {isDraftFinalized && <ResultsScreen players={players} />}
    </div>
  );
}

// Minimal sub-components for immediate fix
function ResultsScreen({ players }) {
  return (
    <div className="fixed inset-0 z-[110] bg-slate-900 p-8 overflow-y-auto flex flex-col items-center">
      <Trophy className="w-20 h-20 text-yellow-500 mb-6 animate-bounce" />
      <h1 className="text-6xl font-black italic uppercase italic">Draft Complete</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full max-w-6xl">
        {players.map(p => (
          <div key={p.id} className="bg-slate-800 p-6 rounded-3xl border-2 border-slate-700">
            <h2 className="text-2xl font-black text-blue-400 uppercase italic mb-4">{p.name}</h2>
            <div className="grid grid-cols-3 gap-2">
              {p.party.map((pk, idx) => (
                <div key={idx} className="bg-slate-900 p-1 rounded-lg border border-slate-700">
                   <img src={pk.sprite || pk.image} className="w-full" alt="" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => window.handleBackToRoom()} className="mt-12 text-slate-500 font-bold uppercase tracking-widest hover:text-white transition-colors">← Back</button>
    </div>
  );
}

function WinCeremony({ data }) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-slate-800 border-4 border-yellow-500 p-12 rounded-[3.5rem] text-center shadow-2xl scale-125">
        <img src={data.image} className="w-48 h-48 mx-auto drop-shadow-2xl" alt="" />
        <h2 className="text-5xl font-black italic uppercase mt-6">{data.pokemon}</h2>
        <p className="text-2xl font-black text-blue-400 mt-2 uppercase">{data.winner}</p>
        <div className="mt-6 bg-green-500 text-slate-900 px-8 py-2 rounded-full font-black text-3xl italic">${data.price}</div>
      </div>
    </div>
  );
}
