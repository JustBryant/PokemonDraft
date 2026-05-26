import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Share2, Users, Banknote, Play, Square, Settings, Link as LinkIcon, UserPlus, Radio, Download, ExternalLink, Zap } from 'lucide-react';
import { PokemonCard } from '../components/PokemonCard';
import { PlayerList } from '../components/PlayerList';
import { AdminPanel } from '../components/AdminPanel';
import { HostSettings } from '../components/HostSettings';
import { supabase, isSupabaseConfigured, db } from '../lib/supabase';

export default function AuctionRoom() {
  const { id: roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Persistence for the host and players
  const [roomState, setRoomState] = useState(() => {
    // If the URL has ?new_player=true, ignore existing session to allow multiple testers in one browser
    const isForcedNew = new URLSearchParams(window.location.search).get('new_player') === 'true';
    const saved = !isForcedNew ? localStorage.getItem(`poke_session_${roomId}`) : null;
    
    if (saved) return JSON.parse(saved);
    return location.state || { isHost: false, playerName: '', startingMoney: 1000 };
  });

  // Core Auction State
  const [players, setPlayers] = useState(() => {
    return JSON.parse(localStorage.getItem(`poke_room_${roomId}_players`) || '[]');
  });
  const [pokemonPool, setPokemonPool] = useState(() => {
    return JSON.parse(localStorage.getItem(`poke_room_${roomId}_pool`) || '[]');
  });
  const [currentPokemonIndex, setCurrentPokemonIndex] = useState(() => {
    return JSON.parse(localStorage.getItem(`poke_room_${roomId}_index`) || '-1');
  });
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [isBiddingActive, setIsBiddingActive] = useState(false);
  const [history, setHistory] = useState([]);
  const [nominationOrder, setNominationOrder] = useState(() => {
    return JSON.parse(localStorage.getItem(`poke_room_${roomId}_nom_order`) || '[]');
  });
  const [currentNomineeIndex, setCurrentNomineeIndex] = useState(() => {
    return JSON.parse(localStorage.getItem(`poke_room_${roomId}_nom_index`) || '0');
  });
  const [timerDuration, setTimerDuration] = useState(() => {
    return JSON.parse(localStorage.getItem(`poke_room_${roomId}_timer_duration`) || '30');
  });
  const [maxPokemon, setMaxPokemon] = useState(() => {
    return JSON.parse(localStorage.getItem(`poke_room_${roomId}_max_pokemon`) || '6');
  });

  const [isDraftFinalized, setIsDraftFinalized] = useState(() => {
    return localStorage.getItem(`poke_room_${roomId}_finalized`) === 'true';
  });

  const currentPokemon = currentPokemonIndex >= 0 ? pokemonPool[currentPokemonIndex] : null;

  const [startingBid, setStartingBid] = useState(() => {
    return JSON.parse(localStorage.getItem(`poke_room_${roomId}_starting_bid`) || '0');
  });

  const [timeLeft, setTimeLeft] = useState(30);

  // Use a local state for startingMoney since it's used for registration
  useEffect(() => {
    const savedMoney = localStorage.getItem(`poke_room_${roomId}_starting_money`);
    if (savedMoney) {
      setRoomState(prev => ({ ...prev, startingMoney: JSON.parse(savedMoney) }));
    }
  }, [roomId]);

  const [isParticipating, setIsParticipating] = useState(roomState.isParticipating || false);
  const [biddersInRound, setBiddersInRound] = useState([]);
  
  // UI State
  const [isAuctionStarted, setIsAuctionStarted] = useState(() => {
    return localStorage.getItem(`poke_room_${roomId}_active_game`) === 'true';
  });
  const [showHostSetup, setShowHostSetup] = useState(() => {
    // Only check this for the host. 
    // Everyone else (players) must NEVER see the setup screen.
    const urlParams = new URL(window.location.href).searchParams;
    const isHostFromUrl = urlParams.get('new_player') !== 'true' && (JSON.parse(localStorage.getItem(`poke_session_${roomId}`) || '{}').isHost);
    
    if (!isHostFromUrl) return false;

    const started = localStorage.getItem(`poke_room_${roomId}_started`) === 'true';
    const pool = JSON.parse(localStorage.getItem(`poke_room_${roomId}_pool`) || '[]');
    return !started && pool.length === 0;
  });
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [hasJoined, setHasJoined] = useState(!!roomState.playerName);
  const [tempName, setTempName] = useState('');

  const toggleSetup = () => {
    if (roomState.isHost) {
      setShowHostSetup(!showHostSetup);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanName = tempName.trim();
    if (!cleanName) return;
    
    // Check if player already exists in the room list
    const existingPlayer = players.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    
    const isForcedNew = new URLSearchParams(window.location.search).get('new_player') === 'true';
    const newState = { 
      ...roomState, 
      playerName: existingPlayer ? existingPlayer.name : cleanName, 
      isHost: false,
      isParticipating: !!existingPlayer
    };

    setRoomState(newState);
    
    // Use the name they type or the exact case-match from the server
    const sessionName = existingPlayer ? existingPlayer.name : cleanName;
    const sessionKey = isForcedNew 
      ? `poke_session_${roomId}_${sessionName}` 
      : `poke_session_${roomId}`;
      
    localStorage.setItem(sessionKey, JSON.stringify(newState));
    setHasJoined(true);
    
    // Only add to Supabase if they don't exist yet
    if (!existingPlayer) {
      const globalStartingMoney = JSON.parse(localStorage.getItem(`poke_room_${roomId}_starting_money`) || '1000');
      const newPlayer = {
        id: `${Date.now()}-${Math.random()}`,
        name: sessionName,
        balance: globalStartingMoney,
        party: [],
        isHost: false
      };
      
      const updated = [...players, newPlayer];
      await updateRoomState({ participants: updated });
    }
  };

  // Update showHostSetup when isAuctionStarted changes
  useEffect(() => {
    if (roomState.isHost) {
      // Host only sees setup if the draft hasn't started and no pool exists yet
      if (isAuctionStarted || pokemonPool.length > 0) {
        setShowHostSetup(false);
      }
    } else {
      setShowHostSetup(false); // Non-hosts never see the setup screen
    }
  }, [isAuctionStarted, roomState.isHost, pokemonPool.length]);

  const [currentBidderIndex, setCurrentBidderIndex] = useState(0);
  const [isSnakeDescending, setIsSnakeDescending] = useState(true);
  const [actualRound, setActualRound] = useState(1);
  const [showWinCeremony, setShowWinCeremony] = useState(false);
  const [lastWinData, setLastWinData] = useState(null);

  const isDraftFinished = useMemo(() => {
    return isDraftFinalized;
  }, [isDraftFinalized]);

  const canHostFinish = useMemo(() => {
    if (!isAuctionStarted || isDraftFinalized) return false;
    const everyoneFull = players.length > 0 && players.every(p => p.party.length >= maxPokemon);
    const poolExhausted = pokemonPool.length > 0 && history.length >= pokemonPool.length;
    return everyoneFull || poolExhausted;
  }, [players, maxPokemon, isAuctionStarted, isDraftFinalized, pokemonPool.length, history.length]);

  const handleFinishDraft = async () => {
    if (!roomState.isHost) return;
    localStorage.setItem(`poke_room_${roomId}_finalized`, 'true');
    await updateRoomState({ is_finalized: true });
    setIsDraftFinalized(true);
  };

  const handleBackToRoom = async () => {
    if (!roomState.isHost) {
      // Just visually go back by disabling result view locally
      setIsDraftFinalized(false);
      return;
    }
    // Host can actually unlock the room for everyone if needed
    localStorage.setItem(`poke_room_${roomId}_finalized`, 'false');
    await updateRoomState({ is_finalized: false });
    setIsDraftFinalized(false);
  };

  // Attach to window so child components can access it
  useEffect(() => {
    window.handleBackToRoom = handleBackToRoom;
  }, [handleBackToRoom]);

  // Turn Timer Effect (Managed by Host)
  useEffect(() => {
    if (!roomState.isHost || !isBiddingActive) {
      if (!isBiddingActive) setTimeLeft(timerDuration);
      return;
    }

    // Set initial time when bidding starts
    setTimeLeft(timerDuration);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        if (newTime <= 0) {
          // Time's up! Trigger auto-skip if it's someone's turn
          const unluckyPlayer = players[currentBidderIndex];
          if (unluckyPlayer) {
             console.log(`[Timer] Time up for ${unluckyPlayer.name}. Auto-skipping...`);
             triggerAutoSkip(unluckyPlayer.name);
          }
          return timerDuration;
        }
        
        // Broadcast time update every second
        updateRoomState({ time_left: newTime });
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isBiddingActive, roomState.isHost, currentBidderIndex, timerDuration, players.length]);

  const triggerAutoSkip = async (playerName) => {
    // If it's my turn, I just call handleSkip
    if (playerName === roomState.playerName) {
      handleSkip();
    } else {
      // If I'm the host forcing someone else to skip
      const updatedBidders = biddersInRound.filter(name => name !== playerName);
      
      const isWinnerDecided = updatedBidders.length === 1 && (highestBidder || updatedBidders[0] === players[currentBidderIndex]?.name);

      if (isWinnerDecided) {
        const winnerName = updatedBidders[0];
        const winner = players.find(p => p.name === winnerName);
        if (winner) {
          setTimeout(() => finalizeSale(winner, currentBid, updatedBidders), 500);
          return;
        }
      }

      if (updatedBidders.length === 0) {
         setTimeout(() => finalizeSale(null, 0, []), 500);
         return;
      }

      let nextBidderIdx = currentBidderIndex;
      if (players[currentBidderIndex].name === playerName) {
        nextBidderIdx = (currentBidderIndex + 1) % players.length;
        let safety = 0;
        while (safety < players.length) {
          const nextPlayer = players[nextBidderIdx];
          if (updatedBidders.includes(nextPlayer.name) && nextPlayer.balance > 0) {
            break;
          }
          nextBidderIdx = (nextBidderIdx + 1) % players.length;
          safety++;
        }
      }

      await updateRoomState({
        bidders_in_round: updatedBidders,
        bidder_index: nextBidderIdx,
        time_left: timerDuration // Reset timer for next person
      });
      setBiddersInRound(updatedBidders);
      setCurrentBidderIndex(nextBidderIdx);
      setTimeLeft(timerDuration);
    }
  };

  const handleStartingMoneyChange = (val) => {
    setRoomState(prev => ({ ...prev, startingMoney: val }));
    localStorage.setItem(`poke_room_${roomId}_starting_money`, JSON.stringify(val));
    updateRoomState({ starting_money: val });
  };

  const handleStartingBidChange = (val) => {
    setStartingBid(val);
    localStorage.setItem(`poke_room_${roomId}_starting_bid`, JSON.stringify(val));
    updateRoomState({ starting_bid: val });
  };

  const handleTimerDurationChange = (val) => {
    const numVal = parseInt(val) || 10;
    setTimerDuration(numVal);
    localStorage.setItem(`poke_room_${roomId}_timer_duration`, JSON.stringify(numVal));
    updateRoomState({ timer_duration: numVal });
  };

  const handleMaxPokemonChange = (val) => {
    setMaxPokemon(val);
    localStorage.setItem(`poke_room_${roomId}_max_pokemon`, JSON.stringify(val));
    updateRoomState({ max_pokemon: val });
  };

  // Auto-skip logic for invalid nominees (Host only)
  useEffect(() => {
    if (!roomState.isHost || isBiddingActive || !isAuctionStarted) return;

    const nomineeName = nominationOrder[currentNomineeIndex];
    if (!nomineeName) return;

    const nominee = players.find(p => p.name === nomineeName);
    const anyoneHasMoney = players.some(p => p.balance > 0 && p.party.length < maxPokemon);

    if (nominee) {
      const isMaxed = nominee.party.length >= maxPokemon;
      const isBrokeWhileOthersHaveMoney = anyoneHasMoney && nominee.balance <= 0;

      if (isMaxed || isBrokeWhileOthersHaveMoney) {
        console.log(`[Host] Auto-skipping invalid nominee: ${nomineeName}`);
        // We can reuse the logic from finalizeSale, or just trigger a dummy sale
        // But a cleaner way is to just call a function that increments the nominee index
        skipInvalidNominee();
      }
    }
  }, [currentNomineeIndex, players, isBiddingActive, isAuctionStarted, maxPokemon]);

  const skipInvalidNominee = async () => {
    let nextNomineeIdx = currentNomineeIndex;
    let nextDescending = isSnakeDescending;
    let nextRound = actualRound;

    // Movement logic (same as finalizeSale)
    if (nextDescending) {
      if (nextNomineeIdx >= nominationOrder.length - 1) {
        nextDescending = false;
        nextRound++;
        nextNomineeIdx = Math.max(0, nextNomineeIdx - 1);
      } else {
        nextNomineeIdx++;
      }
    } else {
      if (nextNomineeIdx <= 0) {
        nextDescending = true;
        nextRound++;
        nextNomineeIdx = Math.min(nominationOrder.length - 1, nextNomineeIdx + 1);
      } else {
        nextNomineeIdx--;
      }
    }

    await updateRoomState({
      nominee_index: nextNomineeIdx,
      is_descending: nextDescending,
      actual_round: nextRound
    });
    setCurrentNomineeIndex(nextNomineeIdx);
    setIsSnakeDescending(nextDescending);
    setActualRound(nextRound);
  };

  useEffect(() => {
    if (!roomId) return;

    // 0. BroadcastChannel for Cross-Browser/Tab Sync
    const channel = new BroadcastChannel(`poke_auction_${roomId}`);
    
    const handleBroadcast = (event) => {
      const { type, data } = event.data;
      console.log('[Broadcast Received]', type, data);
      
      switch (type) {
        case 'STATE_UPDATE':
          if (data.participants) setPlayers(data.participants);
          if (data.pool) setPokemonPool(data.pool);
          if (typeof data.current_index !== 'undefined') setCurrentPokemonIndex(data.current_index);
          if (typeof data.current_bid !== 'undefined') setCurrentBid(data.current_bid);
          if (typeof data.highest_bidder !== 'undefined') setHighestBidder(data.highest_bidder);
          if (typeof data.is_active !== 'undefined') setIsBiddingActive(data.is_active);
          if (typeof data.is_active_game !== 'undefined') setIsAuctionStarted(data.is_active_game);
          if (data.history) setHistory(data.history);
          if (data.nomination_order) setNominationOrder(data.nomination_order);
          if (typeof data.nominee_index !== 'undefined') setCurrentNomineeIndex(data.nominee_index);
          if (typeof data.bidder_index !== 'undefined') setCurrentBidderIndex(data.bidder_index);
          if (data.bidders_in_round) setBiddersInRound(data.bidders_in_round);
          if (typeof data.is_descending !== 'undefined') setIsSnakeDescending(data.is_descending);
          if (typeof data.actual_round !== 'undefined') setActualRound(data.actual_round);
          if (typeof data.timer_duration !== 'undefined') setTimerDuration(data.timer_duration);
          if (typeof data.starting_bid !== 'undefined') setStartingBid(data.starting_bid);
          if (typeof data.max_pokemon !== 'undefined') setMaxPokemon(data.max_pokemon);
          if (typeof data.time_left !== 'undefined') setTimeLeft(data.time_left);
          if (typeof data.is_finalized !== 'undefined') setIsDraftFinalized(data.is_finalized);
          if (data.win_ceremony) {
            setLastWinData(data.win_ceremony);
            setShowWinCeremony(true);
            setTimeout(() => setShowWinCeremony(false), 4000);
          }
          break;
        case 'PLAYER_JOINED':
          // Re-sync player list
          const currentList = JSON.parse(localStorage.getItem(`poke_room_${roomId}_players`) || '[]');
          setPlayers(currentList);
          break;
      }
    };

    channel.onmessage = handleBroadcast;

    // 1. Supabase Logic (Enhancement)
    let supabaseChannel = null;
    if (isSupabaseConfigured) {
      const fetchRoom = async () => {
        try {
          const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
          if (data) {
            setPlayers(data.participants || []);
            setPokemonPool(data.pool || []);
            setCurrentPokemonIndex(data.current_index);
            setCurrentBid(data.current_bid);
            setHighestBidder(data.highest_bidder);
            setIsBiddingActive(data.is_active);
            setIsAuctionStarted(data.is_started);
            setHistory(data.history || []);
          } else if (roomState.isHost && !error) {
            await supabase.from('rooms').insert([{
              id: roomId,
              host_id: roomState.playerName,
              participants: [],
              pool: [],
              current_index: -1,
              is_started: false
            }]);
          }
        } catch (err) {
          console.error('[Supabase Fetch Error]', err);
        }
      };
      fetchRoom();

      try {
        supabaseChannel = supabase.channel(`room:${roomId}`).on('postgres_changes', { 
          event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
        }, (payload) => {
          const data = payload.new;
          if (data) {
            setPlayers(data.participants || []);
            setPokemonPool(data.pool || []);
            setCurrentPokemonIndex(data.current_index);
            setCurrentBid(data.current_bid);
            setHighestBidder(data.highest_bidder);
            setIsBiddingActive(data.is_active);
            setIsAuctionStarted(data.is_started);
            setHistory(data.history || []);
            setNominationOrder(data.nomination_order || []);
            if (data.nominee_index !== undefined) setCurrentNomineeIndex(data.nominee_index);
            if (data.is_descending !== undefined) setIsSnakeDescending(data.is_descending);
            if (data.actual_round !== undefined) setActualRound(data.actual_round);
            if (data.starting_bid !== undefined) setStartingBid(data.starting_bid);
            if (data.timer_duration !== undefined) setTimerDuration(data.timer_duration);
            if (data.max_pokemon !== undefined) setMaxPokemon(data.max_pokemon);
            if (data.time_left !== undefined) setTimeLeft(data.time_left);
            if (data.is_finalized !== undefined) setIsDraftFinalized(data.is_finalized);
            if (data.starting_money !== undefined) {
              setRoomState(prev => ({ ...prev, startingMoney: data.starting_money }));
            }
          }
        }).subscribe();
      } catch (err) {
        console.error('[Supabase Channel Error]', err);
      }
    }

    // 2. LocalStorage Polling (Baseline Sync)
    const roomKey = `poke_room_${roomId}_players`;
    const lastActiveKey = `poke_room_${roomId}_last_active`;

    const fetchInitial = () => {
      try {
        const index = JSON.parse(localStorage.getItem(`poke_room_${roomId}_index`) || '-1');
        const bid = JSON.parse(localStorage.getItem(`poke_room_${roomId}_bid`) || '0');
        const bidder = JSON.parse(localStorage.getItem(`poke_room_${roomId}_bidder`) || 'null');
        const activeState = JSON.parse(localStorage.getItem(`poke_room_${roomId}_active`) || 'false');
        const hist = JSON.parse(localStorage.getItem(`poke_room_${roomId}_history`) || '[]');
        const savedPool = JSON.parse(localStorage.getItem(`poke_room_${roomId}_pool`) || '[]');
        const auctionStatus = localStorage.getItem(`poke_room_${roomId}_active_game`) === 'true';

        setCurrentPokemonIndex(index);
        setCurrentBid(bid);
        setHighestBidder(bidder);
        setIsBiddingActive(activeState);
        setHistory(hist);
        setPokemonPool(savedPool);
        setIsAuctionStarted(auctionStatus);
      } catch (e) {}
    };
    fetchInitial();
    
    const heartbeat = setInterval(() => {
      if (hasJoined && roomState.playerName) {
        let active = JSON.parse(localStorage.getItem(lastActiveKey) || '{}');
        active[roomState.playerName] = Date.now();
        localStorage.setItem(lastActiveKey, JSON.stringify(active));

        // Sync heartbeat to Supabase to prevent auto-cleanup
        if (isSupabaseConfigured) {
          supabase.from('rooms').update({ last_activity_at: new Date().toISOString() }).eq('id', roomId)
            .then(() => {}); // Fire and forget
        }
      }
    }, 15000); // Pulse every 15s for the live DB

    const syncInterval = setInterval(() => {
      // Local Sync runs regardless of Supabase configuration
      const blacklist = JSON.parse(localStorage.getItem(`poke_room_${roomId}_blacklist`) || '[]');
      if (!roomState.isHost && blacklist.includes(roomState.playerName)) {
        localStorage.removeItem(`poke_session_${roomId}`);
        window.location.href = '/';
        return;
      }

      let currentPlayers = JSON.parse(localStorage.getItem(roomKey) || '[]');
      const active = JSON.parse(localStorage.getItem(lastActiveKey) || '{}');
      const now = Date.now();

      // Registration
      if (hasJoined && roomState.playerName) {
        const existingIdx = currentPlayers.findIndex(p => p.name === roomState.playerName);
        const shouldBeInList = !roomState.isHost || isParticipating;

        if (shouldBeInList && existingIdx === -1) {
          const globalStartingMoney = JSON.parse(localStorage.getItem(`poke_room_${roomId}_starting_money`) || '1000');
          const newPlayer = {
            id: roomState.isHost ? 'host' : `${Date.now()}-${Math.random()}`,
            name: roomState.playerName,
            balance: roomState.isHost ? (roomState.startingMoney || globalStartingMoney) : globalStartingMoney,
            party: [],
            isHost: roomState.isHost
          };
          currentPlayers = [...currentPlayers, newPlayer];
          localStorage.setItem(roomKey, JSON.stringify(currentPlayers));
          
          // Notify other browsers a player joined
          try {
            const bc = new BroadcastChannel(`poke_auction_${roomId}`);
            bc.postMessage({ type: 'PLAYER_JOINED', data: { name: roomState.playerName } });
            bc.close();
          } catch (e) {}
        } else if (!shouldBeInList && existingIdx !== -1) {
          currentPlayers = currentPlayers.filter(p => p.name !== roomState.playerName);
          localStorage.setItem(roomKey, JSON.stringify(currentPlayers));
        }
      }

      // If Supabase IS working and configured, we let it be the source of truth
      // Otherwise, the polling below updates the state from LocalStorage
      if (!isSupabaseConfigured) {
        // Force player list sync for everyone
        setPlayers(currentPlayers);

        // POLL RELEVANT SETTINGS
        const timeDur = JSON.parse(localStorage.getItem(`poke_room_${roomId}_timer_duration`) || '30');
        const startBid = JSON.parse(localStorage.getItem(`poke_room_${roomId}_starting_bid`) || '0');
        const startMoney = JSON.parse(localStorage.getItem(`poke_room_${roomId}_starting_money`) || '1000');
        const maxP = JSON.parse(localStorage.getItem(`poke_room_${roomId}_max_pokemon`) || '6');
        
        // Only update local state if it differs to prevent input flicker for host
        if (!roomState.isHost) {
          setTimerDuration(timeDur);
          setStartingBid(startBid);
          setRoomState(prev => ({ ...prev, startingMoney: startMoney }));
          setMaxPokemon(maxP);
        }

        if (roomState.isHost) {
          const cleanedPlayers = currentPlayers.filter(p => {
            const lastSeen = active[p.name] || 0;
            return (now - lastSeen) < 15000 || (lastSeen === 0 && p.id.toString().includes('-'));
          });
          if (JSON.stringify(cleanedPlayers) !== JSON.stringify(currentPlayers)) {
            localStorage.setItem(roomKey, JSON.stringify(cleanedPlayers));
            setPlayers(cleanedPlayers);
          } else {
            setPlayers(currentPlayers);
          }

          // Pull state from localstorage
          const index = JSON.parse(localStorage.getItem(`poke_room_${roomId}_index`) || '-1');
          const bid = JSON.parse(localStorage.getItem(`poke_room_${roomId}_bid`) || '0');
          const bidder = JSON.parse(localStorage.getItem(`poke_room_${roomId}_bidder`) || 'null');
          const bidderIdx = JSON.parse(localStorage.getItem(`poke_room_${roomId}_bidder_index`) || '0');
          const isDesc = JSON.parse(localStorage.getItem(`poke_room_${roomId}_descending`) || 'true');
          const actRound = JSON.parse(localStorage.getItem(`poke_room_${roomId}_actual_round`) || '1');
          const activeState = JSON.parse(localStorage.getItem(`poke_room_${roomId}_active`) || 'false');
          const gameActive = JSON.parse(localStorage.getItem(`poke_room_${roomId}_active_game`) || 'false');
          const hist = JSON.parse(localStorage.getItem(`poke_room_${roomId}_history`) || '[]');
          const savedPool = JSON.parse(localStorage.getItem(`poke_room_${roomId}_pool`) || '[]');
          const timeDur = JSON.parse(localStorage.getItem(`poke_room_${roomId}_timer_duration`) || '30');
          const startBid = JSON.parse(localStorage.getItem(`poke_room_${roomId}_starting_bid`) || '0');
          const maxP = JSON.parse(localStorage.getItem(`poke_room_${roomId}_max_pokemon`) || '6');

          setCurrentPokemonIndex(index);
          setCurrentBid(bid);
          setHighestBidder(bidder);
          setCurrentBidderIndex(bidderIdx);
          setIsSnakeDescending(isDesc);
          setActualRound(actRound);
          setIsBiddingActive(activeState);
          setIsAuctionStarted(gameActive);
          setHistory(hist);
          setPokemonPool(savedPool);
        } else {
          const index = JSON.parse(localStorage.getItem(`poke_room_${roomId}_index`) || '-1');
          const bid = JSON.parse(localStorage.getItem(`poke_room_${roomId}_bid`) || '0');
          const bidder = JSON.parse(localStorage.getItem(`poke_room_${roomId}_bidder`) || 'null');
          const bidderIdx = JSON.parse(localStorage.getItem(`poke_room_${roomId}_bidder_index`) || '0');
          const isDesc = JSON.parse(localStorage.getItem(`poke_room_${roomId}_descending`) || 'true');
          const actRound = JSON.parse(localStorage.getItem(`poke_room_${roomId}_actual_round`) || '1');
          const activeState = JSON.parse(localStorage.getItem(`poke_room_${roomId}_active`) || 'false');
          const gameActive = JSON.parse(localStorage.getItem(`poke_room_${roomId}_active_game`) || 'false');
          const hist = JSON.parse(localStorage.getItem(`poke_room_${roomId}_history`) || '[]');
          const savedPool = JSON.parse(localStorage.getItem(`poke_room_${roomId}_pool`) || '[]');
          const timeDur = JSON.parse(localStorage.getItem(`poke_room_${roomId}_timer_duration`) || '30');
          const startBid = JSON.parse(localStorage.getItem(`poke_room_${roomId}_starting_bid`) || '0');
          const maxP = JSON.parse(localStorage.getItem(`poke_room_${roomId}_max_pokemon`) || '6');
          
          setCurrentPokemonIndex(index);
          setCurrentBid(bid);
          setHighestBidder(bidder);
          setCurrentBidderIndex(bidderIdx);
          setIsSnakeDescending(isDesc);
          setActualRound(actRound);
          setIsBiddingActive(activeState);
          setIsAuctionStarted(gameActive);
          setHistory(hist);
          setPokemonPool(savedPool);
          setPlayers(currentPlayers);
        }
      } else {
        // Even with Supabase, we need to show the local player list in the UI for the host
        setPlayers(currentPlayers);
      }
    }, 1000);

    return () => {
      if (supabaseChannel) {
        try { supabase.removeChannel(supabaseChannel); } catch (e) {}
      }
      channel.close();
      clearInterval(syncInterval);
      clearInterval(heartbeat);
    };
  }, [roomId, roomState.isHost, roomState.playerName, hasJoined, isParticipating]);

  useEffect(() => {
    if (!hasJoined) return;
    const bc = new BroadcastChannel(`poke_auction_${roomId}`);
    bc.postMessage({ type: 'PLAYER_JOINED', data: { name: roomState.playerName } });
    bc.close();
  }, [hasJoined, roomId, roomState.playerName]);

  // Unified Room Update Action
  const updateRoomState = async (updates) => {
    // 0. BROADCAST TO OTHER BROWSERS (Brave/Chrome/Firefox sync)
    try {
      const bc = new BroadcastChannel(`poke_auction_${roomId}`);
      bc.postMessage({ type: 'STATE_UPDATE', data: updates });
      bc.close();
    } catch (e) {
      console.warn('Broadcast failed', e);
    }

    console.log('[SYNC] Updating state:', updates);

    // 1. Local State Sync (Update Immediately for User)
    if (updates.participants) setPlayers(updates.participants);
    if (updates.pool) setPokemonPool(updates.pool);
    if (updates.current_index !== undefined) setCurrentPokemonIndex(updates.current_index);
    if (updates.current_bid !== undefined) setCurrentBid(updates.current_bid);
    if (updates.highest_bidder !== undefined) setHighestBidder(updates.highest_bidder);
    if (updates.is_active !== undefined) setIsBiddingActive(updates.is_active);
    if (updates.is_active_game !== undefined) setIsAuctionStarted(updates.is_active_game);
    if (updates.history) setHistory(updates.history);
    if (updates.nominee_index !== undefined) setCurrentNomineeIndex(updates.nominee_index);
    if (updates.is_descending !== undefined) setIsSnakeDescending(updates.is_descending);
    if (updates.actual_round !== undefined) setActualRound(updates.actual_round);
    if (updates.timer_duration !== undefined) setTimerDuration(updates.timer_duration);
    if (updates.starting_bid !== undefined) setStartingBid(updates.starting_bid);
    if (updates.starting_money !== undefined) setRoomState(prev => ({ ...prev, startingMoney: updates.starting_money }));
    if (updates.max_pokemon !== undefined) setMaxPokemon(updates.max_pokemon);
    if (updates.bidders_in_round) setBiddersInRound(updates.bidders_in_round);
    if (updates.time_left !== undefined) setTimeLeft(updates.time_left);

    // 2. Local Persistence (Source of Truth for same-machine)
    if (updates.participants) localStorage.setItem(`poke_room_${roomId}_players`, JSON.stringify(updates.participants));
    if (updates.pool) localStorage.setItem(`poke_room_${roomId}_pool`, JSON.stringify(updates.pool));
    if (updates.current_index !== undefined) localStorage.setItem(`poke_room_${roomId}_index`, JSON.stringify(updates.current_index));
    if (updates.current_bid !== undefined) localStorage.setItem(`poke_room_${roomId}_bid`, JSON.stringify(updates.current_bid));
    if (updates.is_active !== undefined) localStorage.setItem(`poke_room_${roomId}_active`, JSON.stringify(updates.is_active));
    if (updates.is_started !== undefined) localStorage.setItem(`poke_room_${roomId}_started`, JSON.stringify(updates.is_started));
    if (updates.is_active_game !== undefined) localStorage.setItem(`poke_room_${roomId}_active_game`, JSON.stringify(updates.is_active_game));
    if (updates.highest_bidder !== undefined) localStorage.setItem(`poke_room_${roomId}_bidder`, JSON.stringify(updates.highest_bidder));
    if (updates.history) localStorage.setItem(`poke_room_${roomId}_history`, JSON.stringify(updates.history));
    if (updates.nomination_order) localStorage.setItem(`poke_room_${roomId}_nom_order`, JSON.stringify(updates.nomination_order));
    if (updates.nominee_index !== undefined) localStorage.setItem(`poke_room_${roomId}_nom_index`, JSON.stringify(updates.nominee_index));
    if (updates.bidder_index !== undefined) localStorage.setItem(`poke_room_${roomId}_bidder_index`, JSON.stringify(updates.bidder_index));
    if (updates.bidders_in_round) localStorage.setItem(`poke_room_${roomId}_bidders_round`, JSON.stringify(updates.bidders_in_round));
    if (updates.is_descending !== undefined) localStorage.setItem(`poke_room_${roomId}_descending`, JSON.stringify(updates.is_descending));
    if (updates.actual_round !== undefined) localStorage.setItem(`poke_room_${roomId}_actual_round`, JSON.stringify(updates.actual_round));
    if (updates.timer_duration !== undefined) localStorage.setItem(`poke_room_${roomId}_timer_duration`, JSON.stringify(updates.timer_duration));
    if (updates.starting_bid !== undefined) localStorage.setItem(`poke_room_${roomId}_starting_bid`, JSON.stringify(updates.starting_bid));
    if (updates.starting_money !== undefined) localStorage.setItem(`poke_room_${roomId}_starting_money`, JSON.stringify(updates.starting_money));
    if (updates.max_pokemon !== undefined) localStorage.setItem(`poke_room_${roomId}_max_pokemon`, JSON.stringify(updates.max_pokemon));

    // 2. Database (Production Sync only)
    if (isSupabaseConfigured) {
      await db.update('rooms', roomId, {
        ...updates,
        last_activity_at: new Date().toISOString()
      });
    }
  };

  const handleKickPlayer = async (playerId) => {
    const playerToKick = players.find(p => p.id === playerId);
    if (!playerToKick) return;

    if (window.confirm(`Are you sure you want to kick ${playerToKick.name}?`)) {
      const updatedPlayers = players.filter(p => p.id !== playerId);
      await updateRoomState({ participants: updatedPlayers });
      
      const blacklistKey = `poke_room_${roomId}_blacklist`;
      const blacklist = JSON.parse(localStorage.getItem(blacklistKey) || '[]');
      localStorage.setItem(blacklistKey, JSON.stringify([...blacklist, playerToKick.name]));
      setPlayers(updatedPlayers);
    }
  };

  const startDraft = async (pool) => {
    // 1. Mark pool as created BUT NOT the game as active yet
    localStorage.setItem(`poke_room_${roomId}_started`, 'true');
    localStorage.setItem(`poke_room_${roomId}_active_game`, 'false');
    
    // 2. Clear flags
    setIsAuctionStarted(false); 
    setPokemonPool(pool);
    setShowHostSetup(false);

    // 3. Broadcast pool creation without starting the game logic
    await updateRoomState({
      pool: pool,
      is_started: true,
      is_active_game: false,
      is_active: false,
      current_index: -1,
      timer_duration: timerDuration,
      starting_bid: startingBid,
      max_pokemon: maxPokemon,
      starting_money: roomState.startingMoney
    });
  };

  const beginDraftSequence = async () => {
    // THIS is the actual button click that starts the game loop
    
    // Filter to only include players who are actually in the room (and participating)
    // We already handle participating status via the players list sync logic
    const pNames = players.map(p => p.name);
    
    // Fisher-Yates shuffle for better randomness
    const randomized = [...pNames];
    for (let i = randomized.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
    }

    // Update the players list to match the nomination order for the UI
    const sortedPlayers = randomized.map(name => players.find(p => p.name === name));
    
    await updateRoomState({
      participants: sortedPlayers,
      is_active_game: true,
      nomination_order: randomized,
      nominee_index: 0,
      time_left: timerDuration
    });
  };

  // Immediate sync when participation changes
  useEffect(() => {
    if (roomState.isHost && hasJoined) {
      const roomKey = `poke_room_${roomId}_players`;
      let currentPlayers = JSON.parse(localStorage.getItem(roomKey) || '[]');
      const existingIdx = currentPlayers.findIndex(p => p.name === roomState.playerName);

    if (isParticipating && existingIdx === -1) {
        const globalStartingMoney = JSON.parse(localStorage.getItem(`poke_room_${roomId}_starting_money`) || '1000');
        const newPlayer = {
          id: 'host',
          name: roomState.playerName,
          balance: roomState.startingMoney || globalStartingMoney,
          party: [],
          isHost: true
        };
        const updated = [...currentPlayers, newPlayer];
        localStorage.setItem(roomKey, JSON.stringify(updated));
        setPlayers(updated);
        updateRoomState({ participants: updated });
      } else if (!isParticipating && existingIdx !== -1) {
        const updated = currentPlayers.filter(p => p.name !== roomState.playerName);
        localStorage.setItem(roomKey, JSON.stringify(updated));
        setPlayers(updated);
        updateRoomState({ participants: updated });
      }
    }
  }, [isParticipating]);

  const handleBid = async (multiplier) => {
    // Check if it's the player's turn to bid
    const isMyBidTurn = players[currentBidderIndex]?.name === roomState.playerName;
    if (!isMyBidTurn && !roomState.isHost) {
      alert("It is not your turn to bid!");
      return;
    }

    // Check if player is still in the round (hasn't skipped)
    if (!biddersInRound.includes(roomState.playerName)) {
      alert("You opted out of this round!");
      return;
    }

    const amount = currentBid + multiplier;
    const player = players.find(p => p.name === roomState.playerName);
    
    // Check for max pokemon limit
    if (player && player.party.length >= maxPokemon) {
      alert(`You have reached the maximum limit of ${maxPokemon} Pokemon!`);
      return;
    }

    // Check for zero balance
    if (player && player.balance <= 0) {
      alert("You have no money left to bid!");
      return;
    }

    if (!player || player.balance < amount || !isBiddingActive) return;

    // Move to next bidder in round
    let nextBidderIdx = (currentBidderIndex + 1) % players.length;
    let safety = 0;
    while (safety < players.length) {
      const nextPlayer = players[nextBidderIdx];
      if (biddersInRound.includes(nextPlayer.name) && nextPlayer.balance > 0) {
        break;
      }
      nextBidderIdx = (nextBidderIdx + 1) % players.length;
      safety++;
    }

    // AUTO-WIN LOGIC: If I just bid, and I'm the only person left in the round with money/space
    const othersCanActuallyBid = biddersInRound.filter(name => {
      if (name === player.name) return false;
      const p = players.find(pl => pl.name === name);
      return p && p.balance > amount && p.party.length < maxPokemon;
    });

    if (othersCanActuallyBid.length === 0) {
      console.log(`[Auto-Win] Nobody can outbid ${player.name} (${amount}). Finalizing...`);
      setCurrentBid(amount);
      setHighestBidder(player);
      // Award instantly
      await finalizeSale(player, amount, biddersInRound);
      return;
    }

    await updateRoomState({
      current_bid: amount,
      highest_bidder: player,
      bidder_index: nextBidderIdx,
      time_left: timerDuration
    });
    setCurrentBid(amount);
    setHighestBidder(player);
    setCurrentBidderIndex(nextBidderIdx);
    setTimeLeft(timerDuration);
  };

  const handleSkip = async () => {
    const updatedBidders = biddersInRound.filter(name => name !== roomState.playerName);
    
    // Check if the current highest bidder is now the LAST person left
    // Special Case: If the nominee (who has $0 bid initially) is the one everyone skipped, they win at $0.
    const isWinnerDecided = updatedBidders.length === 1 && (highestBidder || updatedBidders[0] === players[currentBidderIndex]?.name);

    if (isWinnerDecided) {
      // Auto-sell logic
      const winnerName = updatedBidders[0];
      const winner = players.find(p => p.name === winnerName);
      if (winner) {
        setBiddersInRound(updatedBidders);
        // Award instantly
        await finalizeSale(winner, currentBid, updatedBidders);
        return;
      }
    }

    // If zero people left (everyone skipped immediately), nobody wins
    if (updatedBidders.length === 0) {
       await finalizeSale(null, 0, []);
       return;
    }

    // If skipping on your turn, move the bidder index forward immediately
    let nextBidderIdx = currentBidderIndex;
    if (players[currentBidderIndex].name === roomState.playerName) {
      nextBidderIdx = (currentBidderIndex + 1) % players.length;
      let safety = 0;
      while (safety < players.length) {
        const nextPlayer = players[nextBidderIdx];
        if (updatedBidders.includes(nextPlayer.name) && nextPlayer.balance > 0) {
          break;
        }
        nextBidderIdx = (nextBidderIdx + 1) % players.length;
        safety++;
      }
    }

    await updateRoomState({
      bidders_in_round: updatedBidders,
      bidder_index: nextBidderIdx,
      time_left: timerDuration
    });
    setBiddersInRound(updatedBidders);
    setCurrentBidderIndex(nextBidderIdx);
    setTimeLeft(timerDuration);
  };

  const finalizeSale = async (winner, price, currentBidders, forceIndex = -1) => {
    let updatedPlayers = [...players];
    let newHistory = [...history];
    const pokemonToSell = forceIndex >= 0 ? pokemonPool[forceIndex] : pokemonPool[currentPokemonIndex];

    if (winner && pokemonToSell) {
      updatedPlayers = players.map(p => 
        p.name === winner.name 
          ? { ...p, balance: p.balance - price, party: [...p.party, pokemonToSell] }
          : p
      );
      
      newHistory = [{ 
        pokemon: pokemonToSell, 
        winner: winner, 
        price: price 
      }, ...history];
    }

    // SNAKE DRAFT LOGIC FOR NEXT NOMINATION
    let nextNomineeIdx = currentNomineeIndex;
    let nextDescending = isSnakeDescending;
    let nextRound = actualRound;

    if (isSnakeDescending) {
      if (currentNomineeIndex >= nominationOrder.length - 1) {
        nextDescending = false;
        nextRound++;
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
    // CRITICAL FIX: If anyone has money, ONLY those with money & space can nominate.
    // If NOBODY has money, then everyone with space can nominate (Free Agency).
    const anyoneHasMoney = updatedPlayers.some(p => p.balance > 0 && p.party.length < maxPokemon);
    
    let safety = 0;
    while (safety < nominationOrder.length * 2) { // Increased safety to ensure snake turnaround coverage
      const candidateName = nominationOrder[nextNomineeIdx];
      const candidate = updatedPlayers.find(p => p.name === candidateName);
      
      const hasSpace = candidate && candidate.party.length < maxPokemon;
      const hasMoney = candidate && candidate.balance > 0;

      // If money exists in the room, you MUST have money AND space.
      // If no money exists, you only need space.
      const canProceed = anyoneHasMoney 
        ? (hasMoney && hasSpace)
        : hasSpace;

      if (canProceed) break;

      // Move to next candidate in snake order
      if (nextDescending) {
        if (nextNomineeIdx >= nominationOrder.length - 1) {
          nextDescending = false;
          nextRound++;
          nextNomineeIdx = Math.max(0, nextNomineeIdx - 1); // Start going back immediately
        } else {
          nextNomineeIdx++;
        }
      } else {
        if (nextNomineeIdx <= 0) {
          nextDescending = true;
          nextRound++;
          nextNomineeIdx = Math.min(nominationOrder.length - 1, nextNomineeIdx + 1); // Start going forward immediately
        } else {
          nextNomineeIdx--;
        }
      }
      safety++;
    }

    await updateRoomState({
      participants: updatedPlayers,
      history: newHistory,
      is_active: false,
      highest_bidder: null,
      current_index: -1, // Reset selection mode
      nominee_index: nextNomineeIdx,
      is_descending: nextDescending,
      actual_round: nextRound,
      bidders_in_round: [],
      win_ceremony: winner && pokemonToSell ? { 
        winner: winner.name, 
        price: price, 
        pokemon: pokemonToSell.name,
        image: pokemonToSell.image || pokemonToSell.sprite
      } : null
    });

    if (winner && pokemonToSell) {
      setLastWinData({ 
        winner: winner.name, 
        price: price, 
        pokemon: pokemonToSell.name,
        image: pokemonToSell.image || pokemonToSell.sprite
      });
      setShowWinCeremony(true);
      setTimeout(() => setShowWinCeremony(false), 4000);
    }

    setPlayers(updatedPlayers);
    setHistory(newHistory);
    setIsBiddingActive(false);
    setHighestBidder(null);
    setCurrentPokemonIndex(-1);
    setCurrentNomineeIndex(nextNomineeIdx);
    setIsSnakeDescending(nextDescending);
    setActualRound(nextRound);
    setBiddersInRound([]);
  };

  const nominatePokemon = async (index) => {
    const isNomineeTurn = nominationOrder[currentNomineeIndex] === roomState.playerName;
    if (!isNomineeTurn && !roomState.isHost) return; 

    // Check if nominee has reached max pokemon limit
    const nomineeName = nominationOrder[currentNomineeIndex];
    const nomineeIdx = players.findIndex(p => p.name === nomineeName);
    const nominee = players[nomineeIdx];

    // Check if anyone still has money
    const anyoneHasMoney = players.some(p => p.balance > 0 && p.party.length < maxPokemon);

    if (nominee) {
      if (nominee.party.length >= maxPokemon) {
        alert(`${nominee.name} has reached the maximum limit of ${maxPokemon} Pokemon!`);
        return;
      }
      if (anyoneHasMoney && nominee.balance <= 0) {
        alert(`${nominee.name} has no money left and cannot nominate while others still have balance!`);
        return;
      }
    }

    const nomineeWithPokemon = nominee || players.find(p => p.name === roomState.playerName);

    // CRITICAL: Filter for players who CAN actually bid.
    // They must have money AND have space in their party.
    const activeBidders = players
      .filter(p => p.balance > 0 && p.party.length < maxPokemon)
      .map(p => p.name);
    
    // Initial bid from the nominee
    const initialBid = (nomineeWithPokemon.balance <= 0) ? 0 : startingBid;
    
    // Check if ANYONE besides the nominee can bid
    const potentialOpponents = players.filter(p => 
      p.name !== nomineeName && 
      p.balance > initialBid && 
      p.party.length < maxPokemon
    );
    
    const othersCanBid = anyoneHasMoney && potentialOpponents.length > 0;

    if (!othersCanBid) {
      // INSTANT FINALIZATION
      const finalPrice = anyoneHasMoney ? (nomineeWithPokemon.balance > 0 ? startingBid : 0) : 0;
      
      // Update local state immediately to prevent race conditions
      setCurrentPokemonIndex(index);
      setIsBiddingActive(true);
      setHighestBidder(nomineeWithPokemon);
      setCurrentBid(finalPrice);
      setBiddersInRound([nomineeName || roomState.playerName]);

      // Call finalizeSale immediately without a setTimeout to bypass any local UI loops
      // but wrap it in an async-style flow to match the rest of the app's state management
      await finalizeSale(nomineeWithPokemon, finalPrice, [nomineeName || roomState.playerName], index);
      return;
    }

    // Find who's next after the nominee in the list to start the bidding
    let nextBidderIdx = (nomineeIdx + 1) % players.length;
    let safety = 0;
    while (safety < players.length) {
      const nextPlayer = players[nextBidderIdx];
      if (activeBidders.includes(nextPlayer.name) && nextPlayer.name !== nomineeName) {
        break;
      }
      nextBidderIdx = (nextBidderIdx + 1) % players.length;
      safety++;
    }

    await updateRoomState({
      current_index: index,
      current_bid: initialBid,
      is_active: true,
      highest_bidder: nomineeWithPokemon,
      bidders_in_round: [nomineeName, ...activeBidders].filter((v, i, a) => a.indexOf(v) === i),
      bidder_index: nextBidderIdx,
      time_left: timerDuration
    });
    setCurrentPokemonIndex(index);
    setCurrentBid(initialBid);
    setIsBiddingActive(true);
    setHighestBidder(nomineeWithPokemon);
    setBiddersInRound([nomineeName, ...activeBidders].filter((v, i, a) => a.indexOf(v) === i));
    setCurrentBidderIndex(nextBidderIdx);
    setTimeLeft(timerDuration);
  };

  const endBidding = async () => {
    if (highestBidder) {
      finalizeSale(highestBidder, currentBid);
    }
  };

  const copyLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(baseUrl);
    alert(`Invite Link copied! Share this with your friends to let them join the room.`);
  };

  const copyTestLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const testUrl = `${baseUrl}?new_player=true`;
    navigator.clipboard.writeText(testUrl);
    alert(`Test Link copied! Only use this for opening a second window on YOUR computer for testing.`);
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <form onSubmit={handleJoin} className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-sm space-y-6">
          <div className="text-center">
            <UserPlus className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold italic uppercase">Join Auction</h2>
            <p className="text-slate-400 text-sm mt-1">Room: {roomId}</p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2 font-bold uppercase">Your Trainer Name</label>
            <input
              autoFocus
              required
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/10">
            {players.some(p => p.name.toLowerCase() === tempName.trim().toLowerCase()) 
              ? `Rejoin as ${tempName.trim()}` 
              : 'Enter Room'}
          </button>
          
          <div className="pt-4 border-t border-slate-700">
            <button 
              type="button"
              onClick={() => {
                setRoomState({ ...roomState, isHost: true, playerName: 'Host' });
                setHasJoined(true);
              }}
              className="w-full text-slate-500 text-xs hover:text-slate-300 underline transition-colors"
            >
              Wait, I'm the host - take me to setup
            </button>
          </div>
        </form>
      </div>
    );
  }

  // BUT the player should see the main dashboard with a "Waiting for Host" message.
  if (showHostSetup && roomState.isHost && !isAuctionStarted) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <HostSettings 
          onStartAuction={startDraft} 
          onCancel={() => navigate('/')}
          startingMoney={roomState.startingMoney}
          setStartingMoney={handleStartingMoneyChange}
          isParticipating={isParticipating}
          setIsParticipating={(val) => {
            setIsParticipating(val);
            setRoomState(prev => ({ ...prev, isParticipating: val }));
          }}
          timerDuration={timerDuration}
          setTimerDuration={handleTimerDurationChange}
          startingBid={startingBid}
          setStartingBid={handleStartingBidChange}
          maxPokemon={maxPokemon}
          setMaxPokemon={handleMaxPokemonChange}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div 
            onClick={() => navigate('/')}
            className="cursor-pointer group flex items-center gap-2"
          >
            <Trophy className="text-yellow-400 w-8 h-8 group-hover:scale-110 transition-transform" />
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">
              Poke<span className="text-yellow-500">Auction</span>
            </h1>
          </div>
          <div className="h-8 w-[1px] bg-slate-700 hidden md:block"></div>
          <p className="text-sm font-bold text-slate-500 px-3 py-1 bg-slate-800 rounded-full flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`}></span>
            {isSupabaseConfigured ? 'Live' : 'Local P2P'} | ID: {roomId}
          </p>
        </div>

        <div className="flex gap-2">
          {canHostFinish && roomState.isHost && (
            <button
              onClick={handleFinishDraft}
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-6 py-2 rounded-xl font-black uppercase italic tracking-tighter shadow-lg shadow-yellow-500/20 animate-bounce transition-all active:scale-95 mr-2"
            >
              Finish Draft
            </button>
          )}
          {roomState.isHost && (
            <button 
              onClick={() => {
                const next = !isParticipating;
                setIsParticipating(next);
                setRoomState(prev => ({ ...prev, isParticipating: next }));
                // Force an immediate registration update
                const roomKey = `poke_room_${roomId}_players`;
                let currentPlayers = JSON.parse(localStorage.getItem(roomKey) || '[]');
                if (next) {
                  if (!currentPlayers.find(p => p.id === 'host')) {
                    const newPlayer = {
                      id: 'host',
                      name: roomState.playerName || 'Host',
                      balance: roomState.startingMoney || 1000,
                      party: [],
                      isHost: true
                    };
                    localStorage.setItem(roomKey, JSON.stringify([...currentPlayers, newPlayer]));
                  }
                } else {
                  localStorage.setItem(roomKey, JSON.stringify(currentPlayers.filter(p => p.id !== 'host')));
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                isParticipating 
                ? 'bg-green-600/20 border-green-500 text-green-500 hover:bg-green-600/30' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <UserPlus className="w-4 h-4" /> 
              {isParticipating ? 'Participating' : 'Spectating'}
            </button>
          )}

          <button 
            onClick={copyLink}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-slate-700"
          >
            <LinkIcon className="w-4 h-4" /> Copy Invite Link
          </button>

          {roomState.isHost && (
            <button 
              onClick={copyTestLink}
              title="Copy link for testing multiple players in this browser"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-slate-700"
            >
              <Zap className="w-4 h-4 text-yellow-500" /> Test Link
            </button>
          )}
          
          <button 
            onClick={() => setShowPoolModal(true)}
            className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500 text-blue-400 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-500/5"
          >
            <Radio className="w-4 h-4" /> View Pool
          </button>

          {roomState.isHost && (
            <button 
              onClick={() => setShowAdmin(!showAdmin)}
              className={`p-2 rounded-lg border transition-all ${showAdmin ? 'bg-yellow-500 text-slate-900 border-yellow-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          {roomState.isHost && !isAuctionStarted && (
            <button 
              onClick={toggleSetup}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                showHostSetup 
                ? 'bg-blue-600 text-white border-blue-500' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              {showHostSetup ? 'Close Setup' : 'Pool Setup'}
            </button>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <PlayerList players={players} maxPokemon={maxPokemon} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!isAuctionStarted ? (
            <div className="bg-slate-800 rounded-3xl p-12 border border-slate-700 shadow-2xl text-center space-y-6 flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                <Trophy className="w-12 h-12 text-blue-500 animate-bounce" />
              </div>
              <h2 className="text-3xl font-black italic uppercase">Waiting Room</h2>
              <p className="text-slate-400 max-w-md mx-auto">
                The draft hasn't started yet. Once the Host is ready, the auction pool will appear here.
              </p>
              <div className="flex gap-2">
                {players.length} {players.length === 1 ? 'Player' : 'Players'} Joined
              </div>

              {roomState.isHost && pokemonPool.length > 0 && (
                <button
                  onClick={beginDraftSequence}
                  className="mt-4 bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-8 py-4 rounded-xl font-black uppercase text-xl shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all active:scale-95 hover:scale-105"
                >
                  Begin Draft Phase
                </button>
              )}
            </div>
          ) : currentPokemon ? (
            <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
               {/* Grid Background Effect */}
               <div className="absolute inset-0 opacity-10 pointer-events-none" 
                    style={{backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
              
               <div className="relative flex flex-col items-center">
                 <div className="flex items-center gap-2 mb-8 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700">
                   <Play className="text-green-500 w-4 h-4 fill-current" />
                   <span className="text-xs font-black uppercase tracking-widest text-slate-400">Draft Round {actualRound} | {currentPokemonIndex + 1}/{pokemonPool.length}</span>
                 </div>

                 <PokemonCard pokemon={currentPokemon} hidden={!isBiddingActive && !roomState.isHost && !history.some(h => h.pokemon && h.pokemon.id === currentPokemon.id)} />

                 <div className="w-full mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                   <div className="bg-slate-900 rounded-2xl p-6 border-2 border-yellow-500/20 text-center relative overflow-hidden">
                     {/* Pick Flair for Free Agency */}
                     {!players.some(p => p.balance > 0 && p.party.length < maxPokemon) && (
                       <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none"></div>
                     )}
                     <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">
                       {!players.some(p => p.balance > 0 && p.party.length < maxPokemon) ? "FREE AGENCY CLAIM" : "Current Highest Bid"}
                     </p>
                     <p className="text-6xl font-black text-yellow-500 tabular-nums">${currentBid}</p>
                     {highestBidder && (
                       <div className="mt-2 text-green-400 font-bold flex items-center justify-center gap-2">
                          <span className={`w-1.5 h-1.5 bg-green-400 rounded-full ${!players.some(p => p.balance > 0 && p.party.length < maxPokemon) ? 'animate-bounce' : 'animate-ping'}`}></span>
                          {highestBidder.name}
                       </div>
                     )}
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                     {isBiddingActive ? (
                       <>
                         <div className="col-span-2 mb-2 text-center bg-slate-900/50 p-4 rounded-xl border border-slate-700 relative overflow-hidden">
                           <div className="absolute top-0 left-0 h-1 bg-yellow-500 transition-all duration-1000" style={{ width: `${(timeLeft / timerDuration) * 100}%` }}></div>
                           <div className="flex justify-between items-center mb-2">
                             <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">
                                 {!players.some(p => p.balance > 0 && p.party.length < maxPokemon) ? "CLAIMING..." : "Current Bidder"}
                               </p>
                               <div className={`text-lg font-black uppercase italic ${
                                 players[currentBidderIndex]?.name === roomState.playerName 
                                 ? 'text-yellow-500 animate-pulse' 
                                 : 'text-white'
                               }`}>
                                 {players[currentBidderIndex]?.name === roomState.playerName ? 'YOUR TURN' : players[currentBidderIndex]?.name}
                               </div>
                             </div>
                             <div className="text-right">
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                 {!players.some(p => p.balance > 0 && p.party.length < maxPokemon) ? "CONFIRMING" : "Time Remaining"}
                               </p>
                               <div className={`text-2xl font-black tabular-nums ${timeLeft <= 5 ? 'text-red-500 animate-bounce' : 'text-white'}`}>
                                 {timeLeft}s
                               </div>
                             </div>
                           </div>
                         </div>
                         {players.some(p => p.balance > 0 && p.party.length < maxPokemon) ? (
                           <>
                             <button 
                               onClick={() => handleBid(50)}
                               className="bg-blue-600 hover:bg-blue-500 h-16 rounded-xl font-black text-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                               disabled={players[currentBidderIndex]?.name !== roomState.playerName || !biddersInRound.includes(roomState.playerName)}
                             >
                               +$50
                             </button>
                             <button 
                               onClick={() => handleBid(100)}
                               className="bg-indigo-600 hover:bg-indigo-500 h-16 rounded-xl font-black text-xl shadow-lg shadow-indigo-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                               disabled={players[currentBidderIndex]?.name !== roomState.playerName || !biddersInRound.includes(roomState.playerName)}
                             >
                               +$100
                             </button>
                             <button 
                               onClick={handleSkip}
                               className="col-span-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500 text-red-500 h-14 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50"
                               disabled={players[currentBidderIndex]?.name !== roomState.playerName}
                             >
                               Skip / Pass
                             </button>
                           </>
                         ) : (
                           <div className="col-span-2 bg-blue-600/10 border border-blue-500/50 p-6 rounded-xl text-center">
                             <p className="text-blue-400 font-black uppercase text-sm tracking-[0.2em] animate-pulse">Processing Order...</p>
                           </div>
                         )}
                       </>
                     ) : (
                       <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 text-center italic text-slate-500">
                         {currentPokemonIndex >= pokemonPool.length ? 'Draft Finished!' : 'Reviewing Stats...'}
                       </div>
                     )}
                   </div>
                 </div>
               </div>
            </div>
          ) : (
             /* SELECTION PHASE */
             <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700">
               <div className="flex justify-between items-center mb-6">
                 <div>
                   <h2 className="text-2xl font-black uppercase italic">
                     {players.some(p => p.balance > 0 && p.party.length < maxPokemon) ? "Nominations Open" : "Free Agency Picks"}
                   </h2>
                   <p className="text-slate-400 text-sm">
                     {nominationOrder[currentNomineeIndex] === roomState.playerName 
                       ? (players.some(p => p.balance > 0 && p.party.length < maxPokemon) ? "It's YOUR turn to nominate!" : "It's YOUR turn to pick a Pokemon!")
                       : `Waiting for ${nominationOrder[currentNomineeIndex]} to ${players.some(p => p.balance > 0 && p.party.length < maxPokemon) ? "nominate" : "pick"}...`}
                   </p>
                 </div>
                 <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 italic font-bold text-[10px] uppercase tracking-widest text-yellow-500">
                    TURN: {nominationOrder[currentNomineeIndex]}
                 </div>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {pokemonPool.map((poke, idx) => {
                    const isDrafted = history.some(h => h.pokemon && h.pokemon.id === poke.id);
                    const myPlayer = players.find(p => p.name === roomState.playerName);
                    const isMaxedOut = myPlayer && myPlayer.party.length >= maxPokemon;
                    const canNominate = (nominationOrder[currentNomineeIndex] === roomState.playerName) && !isMaxedOut;
                    const isFreeAgency = !players.some(p => p.balance > 0 && p.party.length < maxPokemon);

                    return (
                      <div key={poke.id} className="relative">
                        <button
                          disabled={!canNominate || isDrafted}
                          onClick={() => nominatePokemon(idx)}
                          className={`group relative w-full p-3 rounded-xl border transition-all ${
                            isDrafted 
                            ? 'bg-slate-900/50 border-slate-800 grayscale cursor-not-allowed opacity-50' 
                            : canNominate
                            ? 'bg-slate-900 border-slate-700 hover:border-blue-500 hover:scale-105'
                            : 'bg-slate-900 border-slate-700 opacity-60'
                          }`}
                        >
                          <img src={poke.sprite || poke.image} alt={poke.name} className="w-full h-auto" />
                          <p className="text-[10px] font-black uppercase text-center mt-2 truncate text-slate-400 group-hover:text-white transition-colors">{poke.name}</p>
                          {isDrafted ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="bg-red-600/80 text-white text-[8px] font-black px-2 py-0.5 rounded rotate-12">DRAFTED</span>
                            </div>
                          ) : canNominate && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/20 rounded-xl">
                              <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase shadow-lg">
                                {isFreeAgency ? 'Pick' : 'Nominate'}
                              </span>
                            </div>
                          )}
                        </button>
                        <a 
                          href={`https://pokemondb.net/pokedex/${poke.name.toLowerCase()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-1 right-1 p-1 bg-slate-800/80 rounded-md text-[8px] font-black text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-all opacity-0 hover:opacity-100 active:scale-90 z-20"
                          title="View Info"
                        >
                          DB
                        </a>
                      </div>
                    );
                  })}
               </div>
               
               {pokemonPool.length === 0 && (
                <div className="py-20 text-center">
                   <p className="text-slate-600 italic">No Pokemon in the pool. Host must setup the auction first.</p>
                </div>
               )}
             </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          {roomState.isHost && showAdmin && (
            <AdminPanel players={players} setPlayers={setPlayers} onKickPlayer={handleKickPlayer} />
          )}

          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-bold mb-4 uppercase tracking-tighter border-b border-slate-700 pb-2">Draft History</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {history.length === 0 ? (
                <p className="text-slate-600 italic text-sm text-center py-8 underline underline-offset-8">No Pokemon drafted yet</p>
              ) : (
                history.map((h, i) => {
                  if (!h || !h.pokemon) return null;
                  return (
                    <div key={i} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                      <img src={h.pokemon.image} className="w-10 h-10 object-contain" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate uppercase">{h.pokemon.name}</p>
                        <p className="text-[10px] text-slate-500">Won by <span className="text-blue-400">{h.winner?.name || 'Unknown'}</span></p>
                      </div>
                      <p className="text-yellow-500 font-bold tabular-nums">${h.price}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Pool Modal */}
      {showPoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase italic">Draft Pool</h2>
                <p className="text-slate-400 text-sm">
                  {pokemonPool.filter(p => !history.some(h => h.pokemon && h.pokemon.id === p.id)).length} Pokemon Remaining 
                  ({history.length} Drafted)
                </p>
              </div>
              <button 
                onClick={() => setShowPoolModal(false)}
                className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
              >
                <Square className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 custom-scrollbar">
              {pokemonPool.map((poke) => {
                const isDrafted = history.some(h => h.pokemon && h.pokemon.id === poke.id);
                const winner = history.find(h => h.pokemon && h.pokemon.id === poke.id)?.winner;
                
                return (
                  <div 
                    key={poke.id} 
                    className={`relative p-3 rounded-2xl border transition-all ${
                      isDrafted 
                      ? 'bg-slate-900/40 border-slate-800/50 opacity-40' 
                      : 'bg-slate-900 border-slate-700 hover:border-blue-500'
                    }`}
                  >
                    <a 
                      href={`https://pokemondb.net/pokedex/${poke.name.toLowerCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                      title="View Pokedex"
                    >
                      <img src={poke.sprite || poke.image} alt="" className="w-full h-auto mb-2 group-hover:scale-110 transition-transform cursor-alias" />
                    </a>
                    <p className="text-[10px] font-black uppercase text-center truncate">{poke.name}</p>
                    
                    {isDrafted && (
                      <div className="absolute inset-x-0 bottom-2 text-center pointer-events-none">
                        <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase">
                          {winner?.name || 'Drafted'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex justify-end">
              <button 
                onClick={() => setShowPoolModal(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-xl font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showWinCeremony && <WinCeremony data={lastWinData} />}
      {isDraftFinished && <ResultsScreen players={players} />}
    </div>
  );
}

function ResultsScreen({ players }) {
  const downloadShowdown = () => {
    let text = "";
    players.forEach(p => {
      text += `=== ${p.name}'s Team ===\n\n`;
      p.party.forEach(poke => {
        text += `${poke.name}\n`;
      });
      text += "\n";
    });

    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "draft_teams.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900 overflow-y-auto pt-20 pb-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4 animate-bounce" />
          <h1 className="text-6xl font-black italic uppercase tracking-tighter">Draft <span className="text-yellow-500">Complete</span></h1>
          <p className="text-slate-400 mt-2 font-bold tracking-widest uppercase">The final teams have been decided</p>
          
          <button 
            onClick={downloadShowdown}
            className="mt-8 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 mx-auto shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Download className="w-6 h-6" />
            Export
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {players.map(player => (
            <PlayerResultCard key={player.id} player={player} />
          ))}
        </div>

        <div className="mt-16 text-center">
          <button 
            onClick={() => {
              // Call the handler passed from the main component
              window.handleBackToRoom();
            }}
            className="text-slate-500 hover:text-white font-bold uppercase tracking-widest text-sm transition-colors"
          >
            ← Back to Room (View Stats)
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerResultCard({ player }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div 
        onClick={() => setShowModal(true)}
        className="bg-slate-800 rounded-3xl p-6 border-2 border-slate-700 hover:border-blue-500 transition-all shadow-2xl cursor-pointer group hover:scale-[1.02]"
      >
        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
          <h2 className="text-2xl font-black italic uppercase text-blue-400 truncate pr-4">{player.name}</h2>
          <div className="bg-slate-900 px-3 py-1 rounded-full text-yellow-500 font-bold text-xs border border-yellow-500/20">
            ${player.balance} Left
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {player.party.slice(0, 6).map((poke, idx) => (
            <div key={idx} className="bg-slate-900 rounded-2xl p-2 border border-slate-700 flex flex-col items-center relative">
              <img src={poke.image || poke.sprite} alt={poke.name} className="w-full h-auto object-contain drop-shadow-lg" />
              <p className="text-[9px] font-black uppercase text-center mt-1 truncate text-slate-400 w-full">{poke.name}</p>
            </div>
          ))}
          {/* Filler if fewer than 6 */}
          {player.party.length < 6 && Array.from({ length: 6 - player.party.length }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-900/30 rounded-2xl p-2 border border-slate-700/30 border-dashed flex flex-col items-center justify-center aspect-square">
              <div className="w-8 h-8 rounded-full bg-slate-800/50 border border-slate-700/50"></div>
            </div>
          ))}
        </div>
        {player.party.length > 6 && (
          <div className="mt-4 text-center">
            <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">+ {player.party.length - 6} More Pokemon</span>
          </div>
        )}
        <div className="mt-4 text-center opacity-0 group-hover:opacity-100 transition-opacity">
           <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Click to Expand Team</span>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-[3rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(59,130,246,0.2)]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-4xl font-black italic uppercase text-blue-400 tracking-tighter">{player.name}'s Party</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-1">{player.party.length} Pokemon Total</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowModal(false); }}
                className="bg-slate-800 hover:bg-red-600/20 hover:text-red-500 p-4 rounded-2xl transition-all border border-slate-700"
              >
                <Square className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 custom-scrollbar">
              {player.party.map((poke, idx) => (
                <div key={idx} className="bg-slate-800 rounded-3xl p-4 border-2 border-slate-700 hover:border-blue-500 transition-all flex flex-col items-center group relative shadow-lg">
                  <img src={poke.image || poke.sprite} alt="" className="w-full h-auto object-contain drop-shadow-2xl group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-black italic uppercase text-center mt-3 text-white truncate w-full">{poke.name}</p>
                  <a 
                    href={`https://pokemondb.net/pokedex/${poke.name.toLowerCase()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 p-2 bg-slate-900/80 rounded-xl text-blue-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
            
            <div className="p-8 bg-slate-800/50 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowModal(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-3 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20"
              >
                Back to Players
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WinCeremony({ data }) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-500"></div>
      
      {/* Central Announcement Card */}
      <div className="relative animate-in zoom-in spin-in-1 duration-700 ease-out flex flex-col items-center">
        {/* Confetti-like pulses */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        
        <div className="bg-slate-800 border-4 border-yellow-500 rounded-[3rem] p-10 shadow-[0_0_100px_rgba(234,179,8,0.4)] flex flex-col items-center text-center scale-110">
          <div className="bg-slate-900 rounded-full p-6 border-2 border-slate-700 mb-6 relative group">
             <div className="absolute inset-0 bg-yellow-500/10 rounded-full animate-ping opacity-50"></div>
             <img src={data.image} alt="" className="w-40 h-40 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]" />
          </div>
          
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white mb-2 drop-shadow-lg">
            {data.pokemon} <span className="text-yellow-500">DRAFTED!</span>
          </h2>
          
          <div className="flex flex-col items-center gap-1">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Winner</p>
            <div className="text-5xl font-black text-blue-400 italic skew-x-[-10deg] uppercase drop-shadow-[0_4px_0_#1e3a8a]">
              {data.winner}
            </div>
          </div>
          
          <div className="mt-8 bg-green-500 text-slate-900 px-6 py-2 rounded-full font-black text-2xl shadow-xl shadow-green-500/20 translate-y-4">
            ${data.price}
          </div>
        </div>
        
        {/* Floating particles (simplified CSS fallback) */}
        <div className="mt-12 text-yellow-500/60 font-black animate-bounce text-xl italic uppercase tracking-[0.5em]">
          Congratulations!
        </div>
      </div>
    </div>
  );
}
