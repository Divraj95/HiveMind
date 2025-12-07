# HiveMind

A multiplayer browser game inspired by Herd Mentality. Players answer prompts and score points by matching the most popular answer.

## How to Play

1. One player creates a game and shares the 4-letter room code
2. Other players join using the code
3. Everyone sees a prompt and submits an answer
4. Players who match the most common answer score a point
5. First to 10 points wins (or play as many rounds as you want)

## Local Development

### Prerequisites

- Node.js (v18 or higher)

### Setup

```bash
# Install dependencies
npm install

# Start dev server (auto-reloads on changes)
npm run dev

# Open in browser
open http://localhost:3000
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with auto-reload |
| `npm start` | Start production server |

## Deployment

### Deploy to Railway (Recommended)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" > "Deploy from GitHub repo"
4. Select your repository
5. Railway auto-deploys and provides a URL

### Deploy to Render

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New" > "Web Service"
4. Connect your GitHub repo
5. Set build command: `npm install`
6. Set start command: `npm start`
7. Deploy

## Project Structure

```
HiveMind/
├── server.js          # Express + Socket.io backend
├── package.json
└── public/
    ├── index.html     # Game UI
    ├── style.css      # Styles
    └── game.js        # Client-side logic
```

## Tech Stack

- **Backend:** Node.js, Express, Socket.io
- **Frontend:** Vanilla HTML/CSS/JavaScript
