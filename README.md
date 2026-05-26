# Pokemon Auction Website

A simple, visually appealing tool for hosting Pokemon auctions with friends.

## Features
- **Real-time Bidding Simulation**: Manage auctions for up to 8 players.
- **Admin Controls**: The creator can start/end bidding, assign money, and rename players.
- **Dynamic Pokemon Cards**: Displays Pokemon artwork and stats.
- **Bidding History**: Keep track of all sales in the current session.

## Getting Started

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

### Hosting for Free
To share this with your friends for free, we recommend using **Vercel** or **Netlify**:

1. Push your code to a GitHub repository.
2. Connect the repository to [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).
3. They will provide you with a public URL (e.g., `poke-auction.vercel.app`).

### Multi-player Note
In this simple version, the state is local to the browser. Under the current "simple/free" constraint:
- **Screen Share Method**: The host runs the website and shares their screen (Discord/Zoom). Players call out bids or use the chat, and the host enters them.
- **Real-time Backend (Advanced)**: For a truly decentralized experience (where every player clicks buttons on their own device), you can integrate [Supabase](https://supabase.com/) which has a generous free tier and handles real-time state synchronization.

## Built With
- [Vite](https://vitejs.dev/)
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/) (Icons)
- [PokeAPI](https://pokeapi.co/) (Data)

## Pass
Mf8Oyrg8NR9QCDLm
