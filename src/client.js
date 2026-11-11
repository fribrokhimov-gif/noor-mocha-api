import request from 'supertest';

// Core API: auth + delivery. Override with API_BASE only to point at another env.
export const CORE_URL = process.env.API_BASE || 'https://core.test.api.noor.uz';
// Authenticated endpoints require X-Platform: web | ios | android.
export const X_PLATFORM = process.env.X_PLATFORM || 'web';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function make(base, { platform }) {
  return Object.fromEntries(
    METHODS.map((m) => [
      m,
      (path) => {
        const req = request(base)[m](path).set('Accept', 'application/json');
        return platform ? req.set('X-Platform', X_PLATFORM) : req;
      },
    ]),
  );
}

// `api` sets X-Platform. For protected calls add .set('Authorization', bearer(token)).
export const api = make(CORE_URL, { platform: true });
// Same base, WITHOUT X-Platform — for the "missing X-Platform" guard checks.
api.anon = make(CORE_URL, { platform: false });

export const bearer = (token) => `Bearer ${token}`;
