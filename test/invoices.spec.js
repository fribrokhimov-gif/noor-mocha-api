import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/vendors/invoices';

(phone && password ? describe : describe.skip)('Vendors — invoices', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });

  it('returns a paginated invoices envelope @smoke', async () => {
    const res = await api.get(`${URL}?limit=5&skip=0`).set('Authorization', bearer(token)).expect(200);
    expect(res.body.data, 'data').to.be.an('array');
    for (const k of ['count', 'page_size', 'current_page', 'last_page'])
      expect(res.body[k], k).to.be.a('number');
    expect(res.body.page_size, 'page_size reflects the limit').to.equal(5);
    for (const inv of res.body.data) {
      expect(inv.id, 'id').to.be.a('number');
      expect(inv.amount, 'amount').to.be.a('number');
      for (const k of ['approved_at', 'rejected_at', 'rejected_reason', 'document', 'created_at'])
        expect(inv, k).to.have.property(k);
    }
  });

  it('is rejected without a token', async () => {
    const res = await api.get(`${URL}?limit=5&skip=0`).expect(401);
    expect(payload(res)).to.have.nested.property('error.code', 1001);
  });
});
