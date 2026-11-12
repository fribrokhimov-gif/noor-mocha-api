import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/vendors/clients';
const ENVELOPE = ['data', 'count', 'page_size', 'current_page', 'last_page'];
const CLIENT = ['id', 'first_name', 'last_name', 'email', 'number', 'created_at'];

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
      expect(c.id, 'id').to.be.a('number');
      // Customer name, phone and date must each have a value.
      expect(c.first_name, 'customer name').to.be.a('string').and.not.empty;
      expect(c.number, 'phone').to.be.a('string').and.not.empty;
      expect(c.created_at, 'date').to.be.a('string').and.not.empty;
      expect(Number.isNaN(Date.parse(c.created_at)), 'date is valid').to.be.false;
      // present but nullable
      expect(c.last_name, 'last_name').to.satisfy((v) => v === null || typeof v === 'string');
      expect(c.email, 'email').to.satisfy((v) => v === null || typeof v === 'string');
    }
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
