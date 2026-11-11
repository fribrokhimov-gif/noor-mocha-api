import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, getMe, VENDOR_ME, creds } from '../src/auth.js';

const { phone, password } = creds();

// The access guard, checked on a protected Delivery endpoint (vendors/me).
(phone && password ? describe : describe.skip)('Auth — access guard', () => {
  it('a valid token with X-Platform is accepted @smoke', async () => {
    const { access_token } = await getTokens();
    const res = await getMe(access_token).expect(200);
    expect(res.body).to.have.property('profile');
  });

  it('a request without the X-Platform header is rejected', async () => {
    const { access_token } = await getTokens();
    // api.anon omits X-Platform; the token is still valid.
    const res = await api.anon.get(VENDOR_ME).set('Authorization', bearer(access_token)).expect(400);
    const body = payload(res); // gateway returns JSON as text/plain
    expect(body).to.have.property('code', 1006); // top-level, not under `error`
    expect(body.message).to.match(/X-Platform/i);
  });

  it('a request without a token is rejected', async () => {
    const res = await api.get(VENDOR_ME).expect(401);
    expect(res.body.error).to.equal('unauthorized');
  });

  it('a token sent without the Bearer prefix is rejected', async () => {
    const { access_token } = await getTokens();
    await api.get(VENDOR_ME).set('Authorization', access_token).expect(401);
  });
});
