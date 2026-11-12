import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/vendors/cards';

(phone && password ? describe : describe.skip)('Vendors — cards', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });

  it('returns the saved cards list @smoke', async () => {
    const res = await api.get(URL).set('Authorization', bearer(token)).expect(200);
    expect(res.body, 'cards is an array').to.be.an('array'); // empty for this merchant; TODO: confirm item shape when cards exist
  });

  it('is rejected without a token', async () => {
    const res = await api.get(URL).expect(401);
    expect(payload(res)).to.have.nested.property('error.code', 1001);
  });
});
