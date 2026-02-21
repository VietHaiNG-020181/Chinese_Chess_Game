---
description: Deploy the Chinese Chess game to Fly.io for public multiplayer access
---

# Deploy to Fly.io

## Prerequisites
// turbo-all

1. Install the Fly.io CLI: https://fly.io/docs/flyctl/install/
   ```powershell
   pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. Sign up / log in:
   ```
   fly auth login
   ```

## First-Time Deploy

3. Launch the app (run from the project root):
   ```
   fly launch --name chinese-chess-game --region sjc --no-deploy
   ```
   - Pick the suggested settings or customize
   - Region `sjc` = San Jose (low latency for NA). Change if needed.

4. Deploy:
   ```
   fly deploy
   ```

5. Open your deployed app:
   ```
   fly open
   ```

Your game is now live at `https://chinese-chess-game.fly.dev` (or your chosen name).

## Subsequent Deploys

After making code changes, just run:
```
fly deploy
```

## Useful Commands

- `fly status` — check app status
- `fly logs` — view server logs
- `fly scale count 1` — ensure 1 instance running
- `fly apps destroy chinese-chess-game` — delete the app
