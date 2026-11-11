import request from 'supertest';

const base = process.env.API_BASE;
if (!base) throw new Error('API_BASE is not set (see .env.example)');
const token = process.env.API_TOKEN;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function build(withAuth) {
  const agent = request(base);
  return Object.fromEntries(
    METHODS.map((m) => [
      m,
      (path) => {
        const req = agent[m](path).set('Accept', 'application/json');
        return withAuth && token ? req.set('Authorization', `Bearer ${token}`) : req;
      },
    ]),
  );
}

/** Authenticated client. Use api.anon.* for 401/403 checks. */
export const api = { ...build(true), anon: build(false) };
