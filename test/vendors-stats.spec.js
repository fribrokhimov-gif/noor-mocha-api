import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/vendors/stats';
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const QS = `from_date=${day(-7)}&till_date=${day(1)}&type=daily`;

(phone && password ? describe : describe.skip)('Vendors — stats', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });

  it('returns daily buckets of order count and revenue @smoke', async () => {
    const res = await api.get(`${URL}?${QS}`).set('Authorization', bearer(token)).expect(200);
    expect(res.body, 'stats is an array').to.be.an('array');
    for (const b of res.body) {
      expect(b.date, 'date').to.be.a('string');
      expect(Number.isNaN(Date.parse(b.date)), 'date is valid').to.be.false;
      expect(b.count, 'count').to.be.a('number').and.at.least(0);
      expect(b.total_price, 'total_price').to.be.a('number').and.at.least(0);
    }
  });

  it('is rejected without a token', async () => {
    const res = await api.get(`${URL}?${QS}`).expect(401);
    expect(payload(res)).to.have.nested.property('error.code', 1001);
  });
});
