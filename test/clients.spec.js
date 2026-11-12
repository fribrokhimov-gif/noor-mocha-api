import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/vendors/clients';
const ENVELOPE = ['data', 'count', 'page_size', 'current_page', 'last_page'];
const CLIENT = ['id', 'first_name', 'last_name', 'email', 'number', 'created_at'];
// Fields that must always carry a value (null/empty = a bug). last_name & email are nullable.
const REQUIRED = ['id', 'first_name', 'number', 'created_at'];
const missing = (v) => v === null || v === undefined || v === '';

(phone && password ? describe : describe.skip)('Vendors — clients', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });
  const get = (qs) => api.get(`${URL}${qs}`).set('Authorization', bearer(token));

  it('returns a paginated clients envelope @smoke', async () => {
    const res = await get('?limit=5&skip=0').expect(200);
    expect(res.body).to.include.all.keys(ENVELOPE);
    expect(res.body.data, 'data').to.be.an('array');
    for (const k of ['count', 'page_size', 'current_page', 'last_page'])
      expect(res.body[k], k).to.be.a('number');
    expect(res.body.page_size, 'page_size reflects the limit').to.equal(5);
    expect(res.body.count, 'count >= rows on the page').to.be.at.least(res.body.data.length);

    for (const c of res.body.data) {
      expect(c).to.include.all.keys(CLIENT);
      // present but nullable
      expect(c.last_name, 'last_name').to.satisfy((v) => v === null || typeof v === 'string');
      expect(c.email, 'email').to.satisfy((v) => v === null || typeof v === 'string');
    }
  });

  // Required fields (name, phone, date, id) must never come back null/empty. Scan every row
  // and report all offenders at once, so a bugged null is pinpointed by client id and field.
  it('every client has name, phone and date (no bugged nulls)', async () => {
    const data = (await get('?limit=50&skip=0').expect(200)).body.data;
    const offenders = [];
    for (const c of data)
      for (const k of REQUIRED)
        if (missing(c[k])) offenders.push(`client ${c.id ?? '?'}: ${k}=${c[k] === '' ? 'empty' : c[k]}`);
    expect(offenders, offenders.join('; ')).to.be.empty;
    // phone is always a non-empty string
    for (const c of data) expect(c.number, `client ${c.id} phone`).to.be.a('string').and.not.empty;
  });

  it('paginates by skip (current_page = skip/limit + 1)', async () => {
    const res = await get('?limit=5&skip=5').expect(200);
    expect(res.body.current_page, 'page 2 when skip = limit').to.equal(2);
  });

  it('accepts a new-clients date filter', async () => {
    const res = await get('?new_clients_from=2026-11-01&new_clients_till=2026-11-12&limit=5&skip=0').expect(200);
    expect(res.body.data, 'data').to.be.an('array');
  });

  it('rejects a non-numeric limit with 400 (not a 500)', async () => {
    await get('?limit=abc&skip=0').expect(400);
  });

  it('is rejected without a token', async () => {
    const res = await api.get(`${URL}?limit=5&skip=0`).expect(401);
    expect(payload(res)).to.have.nested.property('error.code', 1001);
  });
});
