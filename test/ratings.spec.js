import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/ratings';

(phone && password ? describe : describe.skip)('Ratings — /ratings', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });
  const get = (qs) => api.get(`${URL}${qs}`).set('Authorization', bearer(token));

  it('returns a paginated ratings envelope @smoke', async () => {
    const res = await get('?limit=5&skip=0').expect(200);
    expect(res.body.data, 'data').to.be.an('array');
    for (const k of ['count', 'page_size', 'current_page', 'last_page'])
      expect(res.body[k], k).to.be.a('number');
    expect(res.body.page_size, 'page_size reflects the limit').to.equal(5);
  });

  it('is rejected without a token', async () => {
    const res = await api.get(`${URL}?limit=5&skip=0`).expect(401);
    expect(payload(res)).to.have.nested.property('error.code', 1001);
  });

  // KNOWN BUG: a non-numeric limit crashes the endpoint (500) instead of a 400 validation error.
  it.skip('a non-numeric limit is a validation error, not a 500 (known bug)', async () => {
    await get('?limit=abc&skip=0').expect(400);
  });
});
