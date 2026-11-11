import { expect } from 'chai';
import { api, bearer } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/vendors/me';

(phone && password ? describe : describe.skip)('Vendors — me', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });

  it('returns the merchant profile for the logged-in account @smoke', async () => {
    const res = await api.get(URL).set('Authorization', bearer(token)).expect(200);
    expect(res.body).to.have.property('profile');
    expect(res.body.profile.role, 'profile.role').to.be.a('string').and.not.empty;
    expect(res.body.phone, 'phone matches the login').to.equal(phone);
    expect(res.body.is_business, 'is_business').to.be.a('boolean');
    for (const k of ['name', 'business_name', 'lang', 'email']) expect(res.body, k).to.have.property(k);
  });

  it('is rejected without a token', async () => {
    const res = await api.get(URL).expect(401);
    expect(res.body.error).to.equal('unauthorized');
  });

  it('is rejected with an invalid token', async () => {
    await api.get(URL).set('Authorization', bearer('abc.def.ghi')).expect(401);
  });
});
