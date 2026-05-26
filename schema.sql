-- Create Rooms table
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  pool JSONB DEFAULT '[]',
  current_index INTEGER DEFAULT -1,
  current_bid INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT FALSE,
  is_started BOOLEAN DEFAULT FALSE,
  highest_bidder JSONB DEFAULT NULL,
  history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  participants JSONB DEFAULT '[]',
  nominee_index INTEGER DEFAULT 0,
  bidder_index INTEGER DEFAULT 0,
  nomination_order JSONB DEFAULT '[]',
  bidders_in_round JSONB DEFAULT '[]',
  is_descending BOOLEAN DEFAULT TRUE,
  actual_round INTEGER DEFAULT 1,
  timer_duration INTEGER DEFAULT 30,
  starting_bid INTEGER DEFAULT 0,
  max_pokemon INTEGER DEFAULT 6,
  time_left INTEGER DEFAULT 30,
  is_finalized BOOLEAN DEFAULT FALSE
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
