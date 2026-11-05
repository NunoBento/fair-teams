# fiveaside.

A small futsal league dashboard for peer-rated player skills and balanced 5-a-side teams.

## Stack

- Angular dashboard: `apps/web`
- NestJS API with Mongoose: `apps/api`
- MongoDB database: `fiveaside` by default

## Accounts and access

Copy `apps/api/.env.example` to `apps/api/.env`, then set a unique `JWT_SECRET` (for example, generate one with `openssl rand -base64 48`) and the initial `ADMIN_USERNAME` and `ADMIN_PASSWORD` (at least 12 characters). The API creates that administrator on first startup only; changing those environment values later does not reset the existing account password.

Sign in as the administrator to add players and create member logins. Each member login is linked to one player profile. The API generates a random temporary password and shows it once, so share it with that member when the account is created. Passwords are stored as bcrypt hashes. Members can sign in, see the roster, and rate other players; they cannot rate their own linked profile. Submitting another rating updates that member's existing rating for the same player.

Administrator sessions can create and remove players, create and remove member accounts, and generate balanced teams. API routes enforce these roles server-side. Sessions use an HTTP-only, same-site cookie; use HTTPS in production.

## Run locally

1. Copy `apps/api/.env.example` to `apps/api/.env` and set the required variables.
2. Start MongoDB locally, or set `MONGODB_URI` to your MongoDB connection string.
3. Install dependencies from the repository root: `npm install`.
4. Start the API: `npm run start:api`.
5. In another terminal, start Angular: `npm run start:web`.
6. Open `http://localhost:4200`.

The Angular dev server proxies `/api` requests to NestJS on port 3000. Sign-in requires the API and MongoDB to be running.

## Deploy to Render

The root `render.yaml` deploys one Node web service: NestJS serves the built Angular application and `/api` from the same origin. This keeps the HTTP-only session cookie same-site and avoids a separate CORS setup. The health check is `GET /api/health`.

1. Push this repository to a Git provider supported by Render.
2. Create a MongoDB database in MongoDB Atlas. In Atlas, create a database user and allow network access from Render (use Render's outbound IP ranges if available for your service; otherwise use Atlas's `0.0.0.0/0` access rule with a strong unique database password).
3. In Render, choose **New → Blueprint**, connect the repository, and deploy the `render.yaml` blueprint. It generates `JWT_SECRET` and prompts for `MONGODB_URI`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.
4. Set `MONGODB_URI` to the Atlas connection string. Replace its database name with `fiveaside` if desired, and URL-encode special characters in the database username/password. Enter a unique admin username and password of at least 12 characters.
5. Wait for the `/api/health` check to pass, open the deployed `onrender.com` URL, sign in as the admin, add player profiles, then create member logins and share each generated password privately.

Do not upload `apps/api/.env` or paste its secrets into source control. The repository ignores `.env` files; configure production secrets in the Render dashboard.

## Player ratings and teams

Ratings use a 1–10 scale across dribbling, speed, shooting, stamina, passing, and defending. Each player's displayed skill value is the median of submitted peer ratings for that skill. The league skill snapshot is the median of the displayed player medians.

The team builder accepts 8 or 10 rated players. It checks every possible split and chooses the one with the smallest summed squared skill-average gaps, so all six skills contribute equally. It reports the difference between the two teams' overall skill averages.

## API

- `GET /api/players`
- `POST /api/auth/login` — `{ "username": "player", "password": "..." }`; sets a session cookie
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users` — administrator only
- `POST /api/users` — administrator only; `{ "username": "jamie", "playerId": "<player id>" }`; returns the generated password once
- `DELETE /api/users/:id` — administrator only
- `POST /api/players` — administrator only; `{ "name": "Jamie Chen", "position": "Ala" }`
- `POST /api/players/:id/ratings` — authenticated; `{ "stats": { "dribbling": 8, "speed": 7, "shooting": 6, "stamina": 8, "passing": 7, "defending": 5 } }`
- `DELETE /api/players/:id` — administrator only; permanently removes a player and their ratings. Remove the linked member account first if one exists.
- `POST /api/teams/generate` — administrator only; `{ "playerIds": ["<8 or 10 MongoDB player ids>"] }`
