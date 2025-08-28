# Flight Delays – React Client

A minimal Vite + React frontend for the flight delay predictor API.

## Dev

1. Start API in another terminal from `server/`:
   - `npm install`
   - `npm run dev` (or `npm start`)
2. Start the client from `client/`:
   - `npm install`
   - `npm run dev`

The client proxies `/airports` and `/predict` to `http://localhost:5000` during dev.

If you deploy the client separately, set `VITE_API_BASE` and update fetch calls accordingly.