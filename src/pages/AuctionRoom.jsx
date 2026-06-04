import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Share2, Users, Banknote, Play, Square, Settings, Link as LinkIcon, UserPlus, Radio, Download, ExternalLink, Zap } from 'lucide-react';
import { PokemonCard } from '../components/PokemonCard';
import { PlayerList } from '../components/PlayerList';
import { AdminPanel } from '../components/AdminPanel';
import { HostSettings } from '../components/HostSettings';
import { supabase, isSupabaseConfigured, db } from '../lib/supabase';

// Helper for local storage
const getSession = (roomId, isForcedNew) => {
  if (isForcedNew) return null;
  const saved = localStorage.getItem(\`poke_session_\${roomId}\`);
  return saved ? JSON.parse(saved) : null;
};

const saveSession = (roomId, session) => {
  localStorage.setItem(\`poke_session_\${roomId}\`, JSON.stringify(session));
};

export default function AuctionRoom() {
  const { id: roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isForcedNew = new URLSearchParams(window.location.search).get('new_player') === 'true';

  // ==========================================
  // 1. IDENTITY STATE (Who am I?)
  // ==========================================
  const [identity, setIdentity] = useState(() => {
    // Priority 1: URL Host Flag
    const urlParams = new URLSearchParams(window.location.search);
    const hostFromUrl = urlParams.get('host') === 'true';

    // Priority 2: Persistent Session
    const saved = getSession(roomId, isForcedNew);
    if (saved) return saved;

    // Priority 3: Navigated State
    if (location.state) return location.state;

    // Default: Spectator
    return { isHost: hostFromUrl, playerName: '', isParticipating: false };
  });

  // ==========================================
  // 2. ROOM STATE (What's happening?)
  // ==========================================
  const [players, setPlayers] = useState([]);
  const [pokemonPool, setPokemonPool] = useState([]);
  const [currentPokemonIndex, setCurrentPokemonIndex] = useState(-1);
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [isBiddingActive, setIsBiddingActive] = useState(false);
  const [isAuctionStarted, setIsAuctionStarted] = useState(false);
  const [history, setHistory] = useState([]);
  const [nominationOrder, setNominationOrder] = useState([]);
  const [currentNomineeIndex, setCurrentNomineeIndex] = useState(0);
  const [currentBidderIndex, setCurrentBidderIndex] = useState(0);
  const [biddersInRound, setBiddersInRound] = useState([]);
  const [isSnakeDescending, setIsSnakeDescending] = useState(true);
  const [actualRound, setActualRound] = useState(1);
  const [timerDuration, setTimerDuration] = useState(30);
  const [startingBid, setStartingBid] = useState(0);
  const [maxPokemon, setMaxPokemon] = useState(6);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isDraftFinalized, setIsDraftFinalized] = useState(false);
  const [startingMoney, setStartingMoney] = useState(1000);

  // ==========================================
  // 3. UI STATE
  // ==========================================
  const [isConnectionLoading, setIsConnectionLoading] = useState(isSupabaseConfigured);
  const [showHostSetup, setShowHostSetup] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [showWinCeremony, setShowWinCeremony] = useState(false);
  const [lastWinData, setLastWinData] = useState(null);
  const [hasJoined, setHasJoined] = useState(!!identity.playerName);
  const [tempName, setTempName] = useState('');

  // ==========================================
  // 4. DERIVED STATE
  // ==========================================
  const currentPokemon = useMemo(() => 
    currentPokemonIndex >= 0 ? pokemonPool[currentPokemonIndex] : null
  , [currentPokemonIndex, pokemonPool]);

  const canHostFinish = useMemo(() => {
    if (!isAuctionStarted || isDraftFinalized) return false;
    const everyoneFull = players.length > 0 && players.every(p => p.party.length >= maxPokemon);
    const poolExhausted = pokemonPool.length > 0 && history.length >= pokemonPool.length;
    return everyoneFull || poolExhausted;
  }, [players, maxPokemon, isAuctionStarted, isDraftFinalized, pokemonPool, history]);

  // ==========================================
  // 5. CORE ACTIONS
  // ==========================================
  const updateRoomState = useCallback(async (updates) => {
    // Local update first for speed
    if (updates.participants) setPlayers(updates.participants);
    if (updates.pool) setPokemonPool(updates.pool);
    if (updates.current_index !== undefined) setCurrentPokemonIndex(updates.current_index);
    if (updates.current_bid !== undefined) setCurrentBid(updates.current_bid);
    if (updates.highest_bidder !== undefined) setHighestBidder(updates.highest_bidder);
    if (updates.is_active !== undefined) setIsBiddingActive(updates.is_active);
    if (updates.is_active_game !== undefined) setIsAuctionStarted(updates.is_active_game);
    if (updates.history) setHistory(updates.history);
    if (updates.nominee_index !== undefined) setCurrentNomineeIndex(updates.nominee_index);
    if (updates.bidder_index !== undefined) setCurrentBidderIndex(updates.bidder_index);
    if (updates.bidders_in_round) setBiddersInRound(updates.bidders_in_round);
    if (updates.is_descending !== undefined) setIsSnakeDescending(updates.is_descending);
    if (updates.actual_round !== undefined) setActualRound(updates.actual_round);
    if (updates.timer_duration !== undefined) setTimerDuration(updates.timer_duration);
    if (updates.starting_bid !== undefined) setStartingBid(updates.starting_bid);
    if (updates.max_pokemon !== undefined) setMaxPokemon(updates.max_pokemon);
    if (updates.time_left !== undefined) setTimeLeft(updates.time_left);
    if (updates.is_finalized !== undefined) setIsDraftFinalized(updates.is_finalized);
    if (updates.starting_money !== undefined) setStartingMoney(updates.starting_money);

    // Sync to other tabs
    try {
      const bc = new BroadcastChannel(\`poke_auction_\${roomId}\`);
      bc.postMessage({ type: 'STATE_UPDATE', data: updates });
      bc.close();
    } catch {}

    // Sync to production DB
    if (isSupabaseConfigured) {
      await db.update('rooms', roomId, {
        ...updates,
        last_activity_at: new Date().toISOString()
      });
    }
  }, [roomId]);

  const updateLocalState = useCallback((data) => {
    if (!data) return;
    if (data.participants) setPlayers(data.participants);
    if (data.pool) setPokemonPool(data.pool);
    if (data.current_index !== undefined) setCurrentPokemonIndex(data.current_index);
    if (data.current_bid !== undefined) setCurrentBid(data.current_bid);
    if (data.highest_bidder !== undefined) setHighestBidder(data.highest_bidder);
    if (data.is_active !== undefined) setIsBiddingActive(data.is_active);
    if (data.is_started !== undefined) setIsAuctionStarted(data.is_started);
    if (data.is_active_game !== undefined) setIsAuctionStarted(data.is_active_game);
    if (data.history) setHistory(data.history);
    if (data.nomination_order) setNominationOrder(data.nomination_order);
    if (data.nominee_index !== undefined) setCurrentNomineeIndex(data.nominee_index);
    if (data.bidder_index !== undefined) setCurrentBidderIndex(data.bidder_index);
    if (data.bidders_in_round) setBiddersInRound(data.bidders_in_round);
    if (data.is_descending !== undefined) setIsSnakeDescending(data.is_descending);
    if (data.actual_round !== undefined) setActualRound(data.actual_round);
    if (data.starting_bid !== undefined) setStartingBid(data.starting_bid);
    if (data.timer_duration !== undefined) setTimerDuration(data.timer_duration);
    if (data.max_pokemon !== undefined) setMaxPokemon(data.max_pokemon);
    if (data.time_left !== undefined) setTimeLeft(data.time_left);
    if (data.is_finalized !== undefined) setIsDraftFinalized(data.is_finalized);
    if (data.starting_money !== undefined) setStartingMoney(data.starting_money);
    if (data.win_ceremony) {
      setLastWinData(data.win_ceremony);
      setShowWinCeremony(true);
      setTimeout(() => setShowWinCeremony(false), 4000);
    }
  }, []);

  // ==========================================
  // 6. INITIAL SYNC & SUBSCRIPTION
  // ==========================================
  useEffect(() => {
    if (!roomId) return;

    // A. Broadcast Channel
    const bc = new BroadcastChannel(\`poke_auction_\${roomId}\`);
    bc.onmessage = (event) => {
      if (event.data.type === 'STATE_UPDATE') updateLocalState(event.data.data);
    };

    // B. Supabase Subscription
    let sbChannel = null;
    const loadRoom = async () => {
      if (!isSupabaseConfigured) {
        setIsConnectionLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
        if (data) {
          updateLocalState(data);
        } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
          // Auto-create room if Host
          if (identity.isHost) {
            await supabase.from('rooms').insert([{
              id: roomId,
              host_id: identity.playerName || 'Host',
              participants: [],
              pool: [],
              is_started: false
            }]);
          }
        }
      } catch (err) {
        console.error('Initial load error:', err);
      } finally {
        setIsConnectionLoading(false);
      }
    };

    if (isSupabaseConfigured) {
      sbChannel = supabase.channel(\`room:\${roomId}\`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: \`id=eq.\${roomId}\` }, 
          (payload) => updateLocalState(payload.new)
        ).subscribe((status) => {
          if (status === 'SUBSCRIBED') loadRoom();
          if (status === 'CHANNEL_ERROR') setIsConnectionLoading(false);
        });
    } else {
      loadRoom();
    }

    // Safety timeout
    const timer = setTimeout(() => setIsConnectionLoading(false), 5000);

    return () => {
      bc.close();
      if (sbChannel) supabase.removeChannel(sbChannel);
      clearTimeout(timer);
    };
  }, [roomId, identity.isHost, identity.playerName, updateLocalState]);

  // ==========================================
  // 7. EVENT HANDLERS
  // ==========================================
  const handleJoin = async (e) => {
    if (e) e.preventDefault();
    const cleanName = tempName.trim();
    if (!cleanName) return;

    // Fetch latest players from DB to avoid overwrites
    let latestPlayers = [];
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('rooms').select('participants').eq('id', roomId).single();
      latestPlayers = data?.participants || [];
    } else {
      latestPlayers = players;
    }

    const existingPlayer = latestPlayers.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    
    const newIdentity = {
      ...identity,
      playerName: existingPlayer ? existingPlayer.name : cleanName,
      isParticipating: true
    };

    setIdentity(newIdentity);
    saveSession(roomId, newIdentity);
    setHasJoined(true);

    if (!existingPlayer) {
      const newPlayer = {
        id: \`\${Date.now()}-\${Math.random()}\`,
        name: newIdentity.playerName,
        balance: startingMoney,
        party: [],
        isHost: newIdentity.isHost
      };
      await updateRoomState({ participants: [...latestPlayers, newPlayer] });
    }
  };

  const finalizeSale = useCallback(async (winner, price, currentBidders, forceIndex = -1) => {
    let updatedPlayers = [...players];
    let newHistory = [...history];
    const targetPokemon = forceIndex >= 0 ? pokemonPool[forceIndex] : currentPokemon;

    if (winner && targetPokemon) {
      updatedPlayers = players.map(p => 
        p.name === winner.name 
          ? { ...p, balance: p.balance - price, party: [...p.party, targetPokemon] }
          : p
      );
      newHistory = [{ pokemon: targetPokemon, winner, price }, ...history];
    }

    // SNAKE DRAFT LOGIC
    let nextNomineeIdx = currentNomineeIndex;
    let nextDescending = isSnakeDescending;
    let nextRound = actualRound;

    const moveSnake = () => {
      if (nextDescending) {
        if (nextNomineeIdx >= nominationOrder.length - 1) { 
          nextDescending = false; nextRound++; 
        } else { nextNomineeIdx++; }
      } else {
        if (nextNomineeIdx <= 0) { 
          nextDescending = true; nextRound++; 
        } else { nextNomineeIdx--; }
      }
    };

    moveSnake();

    // Skip maxed/broke players
    const anyoneHasMoney = updatedPlayers.some(p => p.balance > 0 && p.party.length < maxPokemon);
    let safety = 0;
    while (safety < nominationOrder.length * 2) {
      const candidate = updatedPlayers.find(p => p.name === nominationOrder[nextNomineeIdx]);
      const canDraft = candidate && candidate.party.length < maxPokemon && (anyoneHasMoney ? candidate.balance > 0 : true);
      if (canDraft) break;
      moveSnake();
      safety++;
    }

    await updateRoomState({
      participants: updatedPlayers,
      history: newHistory,
       is_active: false,
      highest_bidder: null,
      current_index: -1,
      nominee_index: nextNomineeIdx,
      is_descending: nextDescending,
      actual_round: nextRound,
      win_ceremony: winner && targetPokemon ? {
        winner: winner.name, price, pokemon: targetPokemon.name, 
        image: targetPokemon.image || targetPokemon.sprite
      } : null
    });
  }, [players, history, pokemonPool, currentPokemon, currentNomineeIndex, isSnakeDescending, actualRound, nominationOrder, maxPokemon, updateRoomState]);

  const handleBid = async (inc) => {
    const isMyTurn = players[currentBidderIndex]?.name === identity.playerName;
    if (!isMyTurn && !identity.isHost) return;
    if (!biddersInRound.includes(identity.playerName)) return;

    const me = players.find(p => p.name === identity.playerName);
    const amount = currentBid + inc;

    if (!me || me.balance < amount || me.party.length >= maxPokemon) return;

    // Find next bidder
    let nextIdx = (currentBidderIndex + 1) % players.length;
    let safety = 0;
    while (safety < players.length) {
      const nextP = players[nextIdx];
      if (biddersInRound.includes(nextP.name) && nextP.balance > amount) break;
      nextIdx = (nextIdx + 1) % players.length;
      safety++;
    }

    // Check if anyone else can actually outbid this
    const potentialOutbidders = biddersInRound.filter(name => {
      if (name === me.name) return false;
      const p = players.find(pl => pl.name === name);
      return p && p.balance > amount && p.party.length < maxPokemon;
    });

    if (potentialOutbidders.length === 0) {
      await finalizeSale(me, amount, biddersInRound);
    } else {
      await updateRoomState({
        current_bid: amount,
        highest_bidder: me,
        bidder_index: nextIdx,
        time_left: timerDuration
      });
    }
  };

  const handleSkip = useCallback(async () => {
    const remaining = biddersInRound.filter(n => n !== identity.playerName);
    
    if (remaining.length === 1 && (highestBidder || remaining[0] === players[currentBidderIndex]?.name)) {
      const winner = players.find(p => p.name === remaining[0]);
      if (winner) await finalizeSale(winner, currentBid, remaining);
      return;
    }

    if (remaining.length === 0) {
      await finalizeSale(null, 0, []);
      return;
    }

    let nextIdx = currentBidderIndex;
    if (players[currentBidderIndex].name === identity.playerName) {
      nextIdx = (currentBidderIndex + 1) % players.length;
      let safety = 0;
      while (safety < players.length) {
        if (remaining.includes(players[nextIdx].name)) break;
        nextIdx = (nextIdx + 1) % players.length;
        safety++;
      }
    }

    await updateRoomState({
      bidders_in_round: remaining,
      bidder_index: nextIdx,
      time_left: timerDuration
    });
  }, [biddersInRound, identity.playerName, highestBidder, players, currentBidderIndex, currentBid, timerDuration, finalizeSale, updateRoomState]);

  const nominatePokemon = async (idx) => {
    const nomineeName = nominationOrder[currentNomineeIndex];
    if (nomineeName !== identity.playerName && !identity.isHost) return;

    const nominee = players.find(p => p.name === nomineeName);
    if (!nominee || nominee.party.length >= maxPokemon) return;

    const anyoneHasMoney = players.some(p => p.balance > 0 && p.party.length < maxPokemon);
    const initialBid = (anyoneHasMoney && nominee.balance > 0) ? startingBid : 0;
    
    const activeBidders = players
      .filter(p => p.balance > initialBid && p.party.length < maxPokemon)
      .map(p => p.name);

    if (activeBidders.length === 0 || (!anyoneHasMoney)) {
      await finalizeSale(nominee, initialBid, [nominee.name], idx);
      return;
    }

    let nextIdx = (players.indexOf(nominee) + 1) % players.length;
    let safety = 0;
    while (safety < players.length) {
      if (activeBidders.includes(players[nextIdx].name) && players[nextIdx].name !== nomineeName) break;
      nextIdx = (nextIdx + 1) % players.length;
      safety++;
    }

    await updateRoomState({
      current_index: idx,
      current_bid: initialBid,
      is_active: true,
      highest_bidder: nominee,
      bidders_in_round: [nomineeName, ...activeBidders].filter((v, i, a) => a.indexOf(v) === i),
      bidder_index: nextIdx,
      time_left: timerDuration
    });
  };

  // Turn Timer Effect (Managed by Host)
  useEffect(() => {
    if (!identity.isHost || !isBiddingActive) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          handleSkip();
          return timerDuration;
        }
        updateRoomState({ time_left: next });
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [identity.isHost, isBiddingActive, timerDuration, handleSkip, updateRoomState]);

  // ==========================================
  // 8. RENDER LOGIC
  // ==========================================
  if (isConnectionLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-bold italic uppercase tracking-widest">Connecting to Room...</h2>
        <button onClick={() => setIsConnectionLoading(false)} className="text-xs text-slate-500 hover:text-white underline mt-4">Manual Bypass</button>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <form onSubmit={handleJoin} className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-sm space-y-6">
          <div className="text-center">
            <UserPlus className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold italic uppercase tracking-tighter">Enter Trainer Name</h2>
          </div>
          <input
            autoFocus required type="text" value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-all shadow-lg">Enter Room</button>
        </form>
      </div>
    );
  }

  if (showHostSetup && identity.isHost && !isAuctionStarted) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <HostSettings 
          onStartAuction={(pool) => {
            updateRoomState({
              pool, is_started: true, is_active_game: false,
              timer_duration: timerDuration, starting_bid: startingBid,
              max_pokemon: maxPokemon, starting_money: startingMoney
            });
            setShowHostSetup(false);
          }}
          onCancel={() => navigate('/')} startingMoney={startingMoney}
          setStartingMoney={(v) => { setStartingMoney(v); updateRoomState({ starting_money: v }); }}
          isParticipating={identity.isParticipating}
          setIsParticipating={(v) => setIdentity(prev => ({ ...prev, isParticipating: v }))}
          timerDuration={timerDuration} setTimerDuration={(v) => { setTimerDuration(v); updateRoomState({ timer_duration: v }); }}
          startingBid={startingBid} setStartingBid={(v) => { setStartingBid(v); updateRoomState({ starting_bid: v }); }}
          maxPokemon={maxPokemon} setMaxPokemon={(v) => { setMaxPokemon(v); updateRoomState({ max_pokemon: v }); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 border-b border-slate-800 pb-8">
        <div className="flex items-center gap-6">
          <div onClick={() => navigate('/')} className="cursor-pointer group flex items-center gap-3">
            <Trophy className="text-yellow-400 w-10 h-10 group-hover:scale-110 transition-transform" />
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">
              Poke<span className="text-yellow-500">Auction</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700">
            <span className={`w-2.5 h-2.5 rounded-full \${isSupabaseConfigured ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-blue-500'}\`}></span>
            <span className="text-xs font-black tracking-widest text-slate-400 uppercase">{roomId}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canHostFinish && identity.isHost && (
            <button onClick={() => updateRoomState({ is_finalized: true })} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-6 py-2 rounded-xl font-black uppercase italic tracking-tighter shadow-lg shadow-yellow-500/20 animate-bounce transition-all">
              Finish Draft
            </button>
          )}

          <button onClick={() => {
            const baseUrl = window.location.origin + window.location.pathname;
            navigator.clipboard.writeText(baseUrl);
            alert("Invite Link Copied!");
          }} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-slate-700">
            <LinkIcon className="w-4 h-4" /> Invite
          </button>
          
          {identity.isHost && (
            <button onClick={() => setShowAdmin(!showAdmin)} className={`p-2 rounded-lg border transition-all \${showAdmin ? 'bg-yellow-500 text-slate-900 border-yellow-500' : 'bg-slate-800 text-slate-400 border-slate-700'}\`}>
              <Settings className="w-5 h-5" />
            </button>
          )}

          {identity.isHost && !isAuctionStarted && (
            <button onClick={() => setShowHostSetup(true)} className="flex items-center gap-2 bg-blue-600/10 border border-blue-500/50 text-blue-400 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-600 hover:text-white transition-all">
               Setup Pool
            </button>
          )}

          <button onClick={() => setShowPoolModal(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold border border-slate-700">
            <Radio className="w-4 h-4" /> View Pool
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <PlayerList players={players} maxPokemon={maxPokemon} />
        </div>

        <div className="lg:col-span-2">
          {!isAuctionStarted ? (
            <div className="bg-slate-800 rounded-[2rem] p-12 border border-slate-700 shadow-2xl text-center space-y-8 flex flex-col items-center justify-center min-h-[500px]">
              <div className="w-32 h-32 bg-blue-500/10 rounded-full flex items-center justify-center relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-20"></div>
                <Trophy className="w-16 h-16 text-blue-500 animate-bounce" />
              </div>
              <div>
                <h2 className="text-4xl font-black italic uppercase tracking-tight mb-4">Draft Room Ready</h2>
                <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
                  Waiting for host to finalize settings and start the nomination phase.
                </p>
              </div>
              <div className="bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-700 font-black italic tracking-widest text-blue-400 uppercase">
                {players.length} Players Connected
              </div>
              {identity.isHost && pokemonPool.length > 0 && (
                <button onClick={async () => {
                   const randomized = [...players].sort(() => Math.random() - 0.5).map(p => p.name);
                   await updateRoomState({
                     participants: randomized.map(name => players.find(p => p.name === name)),
                     is_active_game: true, nomination_order: randomized, nominee_index: 0, time_left: timerDuration
                   });
                }} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-12 py-5 rounded-2xl font-black uppercase text-2xl shadow-xl transition-all active:scale-95 hover:scale-105 italic">
                  Begin Draft Phase
                </button>
              )}
            </div>
          ) : currentPokemon ? (
             <div className="bg-slate-800 rounded-[2.5rem] p-10 border border-slate-700 shadow-2xl relative overflow-hidden min-h-[600px] flex flex-col items-center justify-center">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'radial-gradient(#475569 1.5px, transparent 1.5px)', backgroundSize: '32px 32px'}}></div>
                <div className="relative w-full max-w-lg mb-8">
                  <div className="flex items-center justify-center gap-3 mb-10 bg-slate-900/50 px-6 py-2 rounded-full border border-slate-700 mx-auto w-fit">
                    <Play className="text-green-500 w-4 h-4 fill-current" />
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Draft Round {actualRound} | {history.length + 1} of {pokemonPool.length}</span>
                  </div>
                  <PokemonCard pokemon={currentPokemon} hidden={!isBiddingActive && !identity.isHost} />
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center mt-6">
                   <div className="bg-slate-900 rounded-3xl p-8 border-2 border-yellow-500/20 text-center relative overflow-hidden group">
                     <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                     <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Highest Bid</p>
                     <p className="text-7xl font-black text-yellow-500 tabular-nums my-2 italic tracking-tighter">${currentBid}</p>
                     {highestBidder && (
                       <div className="text-green-400 font-black uppercase italic text-lg tracking-tight mt-4 flex items-center justify-center gap-2">
                         <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span> {highestBidder.name}
                       </div>
                     )}
                   </div>

                   <div className="space-y-4">
                     {isBiddingActive ? (
                        <>
                          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 relative overflow-hidden">
                             <div className="absolute top-0 left-0 h-1.5 bg-yellow-500 transition-all duration-1000" style={{ width: \`\${(timeLeft / timerDuration) * 100}%\` }}></div>
                             <div className="flex justify-between items-center">
                               <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Active Bidder</p>
                                 <p className={\`text-xl font-black uppercase italic \${players[currentBidderIndex]?.name === identity.playerName ? 'text-yellow-500' : 'text-white'}\`}>
                                   {players[currentBidderIndex]?.name === identity.playerName ? 'YOUR TURN' : players[currentBidderIndex]?.name}
                                 </p>
                               </div>
                               <div className="text-right">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Timer</p>
                                 <p className={\`text-3xl font-black tabular-nums \${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}\`}>{timeLeft}s</p>
                               </div>
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <button onClick={() => handleBid(50)} className="bg-blue-600 hover:bg-blue-500 h-16 rounded-2xl font-black text-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                               disabled={players[currentBidderIndex]?.name !== identity.playerName}>+$50</button>
                             <button onClick={() => handleBid(100)} className="bg-indigo-600 hover:bg-indigo-500 h-16 rounded-2xl font-black text-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                               disabled={players[currentBidderIndex]?.name !== identity.playerName}>+$100</button>
                             <button onClick={handleSkip} className="col-span-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/50 text-red-500 h-14 rounded-2xl font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50"
                               disabled={players[currentBidderIndex]?.name !== identity.playerName}>Pass / Out</button>
                          </div>
                        </>
                     ) : (
                        <div className="bg-slate-900/50 p-10 rounded-3xl border border-slate-800 text-center font-black italic uppercase tracking-widest text-slate-600 border-dashed">
                          Waiting for Nomination...
                        </div>
                     )}
                   </div>
                </div>
             </div>
          ) : (
            /* SELECTION GRID */
            <div className="bg-slate-800 rounded-[2.5rem] p-10 border border-slate-700 shadow-2xl space-y-8">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-700">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tight">Open Nominations</h2>
                    <p className="text-slate-400 font-medium">Draft Turn: <span className="text-yellow-500 font-black">{nominationOrder[currentNomineeIndex]}</span></p>
                  </div>
                  <div className="bg-blue-500/10 text-blue-400 px-6 py-2 rounded-2xl border border-blue-500/20 font-black italic uppercase tracking-widest">
                    {nominationOrder[currentNomineeIndex] === identity.playerName ? 'Your Selection' : 'Waiting...'}
                  </div>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {pokemonPool.map((poke, idx) => {
                    const isDrafted = history.some(h => h.pokemon && h.pokemon.id === poke.id);
                    const canNominate = (nominationOrder[currentNomineeIndex] === identity.playerName) && !isDrafted;

                    return (
                      <div key={poke.id} className="relative group">
                        <button disabled={!canNominate} onClick={() => nominatePokemon(idx)} className={\`w-full p-4 rounded-3xl border-2 transition-all \${
                          isDrafted ? 'bg-slate-900/50 border-slate-800 opacity-40 grayscale pointer-events-none' :
                          canNominate ? 'bg-slate-900 border-slate-700 hover:border-blue-500 hover:scale-[1.03] shadow-lg hover:shadow-blue-500/10' :
                          'bg-slate-900 border-slate-700 opacity-60'
                        }\`}>
                          <img src={poke.sprite || poke.image} alt="" className="w-full h-auto drop-shadow-xl" />
                          <p className="text-[10px] font-black uppercase text-center mt-3 text-slate-500 group-hover:text-white transition-colors tracking-tight truncate">{poke.name}</p>
                          {isDrafted && <div className="absolute inset-0 flex items-center justify-center"><span className="bg-red-600/90 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest rotate-[-15deg]">Drafted</span></div>}
                          {canNominate && <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Zap className="w-4 h-4 text-yellow-500" /></div>}
                        </button>
                      </div>
                    );
                  })}
               </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          {identity.isHost && showAdmin && <AdminPanel players={players} setPlayers={setPlayers} onKickPlayer={async (id) => {
             const updated = players.filter(p => p.id !== id);
             await updateRoomState({ participants: updated });
          }} />}
          
          <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-xl overflow-hidden flex flex-col max-h-[700px]">
            <h2 className="text-xl font-black italic uppercase tracking-tight mb-6 border-b border-slate-700 pb-4">Draft Log</h2>
            <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-1">
              {history.length === 0 ? (
                <div className="py-20 text-center opacity-30 select-none grayscale"><Radio className="w-12 h-12 mx-auto mb-4" /><p className="font-bold italic uppercase tracking-widest text-xs underline underline-offset-8">No Entries Yet</p></div>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="flex items-center gap-4 bg-slate-900/60 p-3 rounded-2xl border border-slate-700/50 group hover:border-slate-600 transition-colors">
                    <img src={h.pokemon.image || h.pokemon.sprite} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase italic tracking-tight truncate">{h.pokemon.name}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase"><span className="text-blue-400">{h.winner?.name}</span> • <span className="text-yellow-500">\${h.price}</span></p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODALS */}
      {showPoolModal && <PoolModal pool={pokemonPool} history={history} onClose={() => setShowPoolModal(false)} />}
      {showWinCeremony && <WinCeremony data={lastWinData} />}
      {isDraftFinalized && <ResultsScreen players={players} onBack={() => { if(identity.isHost) updateRoomState({ is_finalized: false }); else setIsDraftFinalized(false); }} />}
    </div>
  );
}

// Sub-components
function PoolModal({ pool, history, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-[3rem] w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-10 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Auction Pool</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-2">{pool.length - history.length} Available / {history.length} Drafted</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-slate-800 rounded-2xl transition-all border border-slate-800 hover:border-slate-700"><Square className="w-8 h-8 rotate-45" /></button>
        </div>
        <div className="p-10 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 custom-scrollbar">
          {pool.map((poke) => {
             const draftEntry = history.find(h => h.pokemon.id === poke.id);
             return (
               <div key={poke.id} className={\`relative p-4 rounded-3xl border transition-all \${draftEntry ? 'bg-slate-950/50 border-slate-900 opacity-40' : 'bg-slate-800/50 border-slate-700'}\`}>
                 <img src={poke.sprite || poke.image} alt="" className="w-full h-auto drop-shadow-lg" />
                 <p className="text-[9px] font-black uppercase text-center mt-2 truncate text-slate-500 italic">{poke.name}</p>
                 {draftEntry && <div className="absolute inset-0 flex items-center justify-center"><span className="bg-red-600/20 text-red-500 border border-red-500/30 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{draftEntry.winner?.name}</span></div>}
               </div>
             );
          })}
        </div>
        <div className="p-8 bg-slate-950/30 border-t border-slate-800 flex justify-end"><button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-3 rounded-2xl font-black italic uppercase tracking-widest transition-all">Close</button></div>
      </div>
    </div>
  );
}

function WinCeremony({ data }) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-500"></div>
      <div className="relative animate-in zoom-in spin-in-1 duration-700 ease-out flex flex-col items-center">
        <div className="bg-slate-800 border-4 border-yellow-500 rounded-[4rem] p-12 shadow-[0_0_120px_rgba(234,179,8,0.3)] flex flex-col items-center text-center">
          <div className="bg-slate-900 rounded-full p-10 border-4 border-slate-700 mb-8 relative">
             <div className="absolute inset-0 bg-yellow-500/10 rounded-full animate-ping opacity-30"></div>
             <img src={data.image} alt="" className="w-56 h-56 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-110 transition-transform" />
          </div>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white mb-2 leading-none">{data.pokemon} <span className="text-yellow-500">SOLD!</span></h2>
          <div className="flex flex-col items-center gap-2 mt-8">
            <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[10px]">Winning Trainer</p>
            <div className="text-6xl font-black text-blue-400 italic uppercase drop-shadow-[0_4px_10px_rgba(59,130,246,0.3)]">{data.winner}</div>
          </div>
          <div className="mt-10 bg-green-500/20 text-green-400 border-2 border-green-500/30 px-10 py-3 rounded-full font-black text-4xl shadow-green-500/10 shadow-2xl italic tracking-tighter">\${data.price}</div>
        </div>
      </div>
    </div>
  );
}

function ResultsScreen({ players, onBack }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 overflow-y-auto py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6 animate-bounce" />
          <h1 className="text-7xl font-black italic uppercase tracking-tighter">Draft <span className="text-yellow-500">Finished</span></h1>
          <p className="text-slate-500 mt-4 font-black tracking-widest uppercase text-sm">Teams have been finalized</p>
          <button onClick={() => {
            const text = players.map(p => \`=== \${p.name}'s Team ===\n\${p.party.map(poke => poke.name).join('\n')}\`).join('\n\n');
            const blob = new Blob([text], {type: 'text/plain'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'draft_results.txt'; a.click();
          }} className="mt-10 bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black italic uppercase tracking-widest flex items-center gap-3 mx-auto transition-all active:scale-95 shadow-2xl shadow-blue-600/20"><Download className="w-6 h-6" /> Export Results</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {players.map(p => (
            <div key={p.id} className="bg-slate-800 rounded-[3rem] p-10 border-2 border-slate-700 shadow-2xl group hover:border-blue-500/50 transition-all">
              <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-6">
                <h3 className="text-3xl font-black italic uppercase text-blue-400 truncate pr-4">{p.name}</h3>
                <div className="bg-slate-900 border border-yellow-500/20 px-4 py-1.5 rounded-full text-yellow-500 font-black text-xs italic">\${p.balance} Left</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {p.party.map((poke, i) => (
                  <div key={i} className="bg-slate-900/60 rounded-3xl p-3 border border-slate-700 flex flex-col items-center group-hover:bg-slate-900 transition-colors">
                    <img src={poke.image || poke.sprite} className="w-full h-auto drop-shadow-xl" alt="" />
                    <p className="text-[8px] font-black uppercase text-center mt-2 truncate text-slate-500 w-full italic">{poke.name}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-20 text-center"><button onClick={onBack} className="text-slate-600 hover:text-white font-black italic uppercase tracking-[0.4em] text-sm transition-colors">← Exit Results View</button></div>
      </div>
    </div>
  );
}
