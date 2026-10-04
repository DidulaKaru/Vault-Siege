# Vault Siege

Vault Siege is a team treasure-hunt platform with a React client and an Express/PostgreSQL API.

## Structure

- `client/` contains the Vite React application.
- `server/` contains the Express API, PostgreSQL schema, authentication middleware, and puzzle validation engine.

## Development

Create `server/.env` from `server/.env.example` and provide `DATABASE_URL` and `JWT_SECRET`.

Initialize the database:

```bash
cd server
npm install
npm run db:init
npm start
```

Run the client in a second terminal:

```bash
cd client
npm install
npm run dev
```

The client defaults to `http://localhost:5000` for the API. Set `VITE_API_URL` when the API runs elsewhere.

## API

Player routes are mounted under `/api/v1/play`:

- `POST /login` authenticates a team with an access code.
- `GET /stage` returns the current puzzle for the authenticated team.
- `POST /submit` validates an answer and advances the team.

Admin routes are mounted under `/api/v1/admin`:

- `POST /login` authenticates an administrator.
- `GET /puzzles` lists stages for a hunt.
- `POST /puzzles` creates a stage.
- `PUT /puzzles/:id` updates a stage.
- `DELETE /puzzles/:id` removes a stage.
