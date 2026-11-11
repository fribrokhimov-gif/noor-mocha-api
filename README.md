# noor-mocha-api

Mocha + Chai + Supertest API test suite. See `CLAUDE.md` for conventions.

```bash
npm ci
cp .env.example .env   # set API_BASE, API_TOKEN
npm test
```

CI: set repo variable `API_BASE` and secret `API_TOKEN` (Settings → Secrets and variables → Actions).
