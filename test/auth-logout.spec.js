import { expect } from 'chai';
import { api, payload } from '../src/client.js';
import { getTokens, logout, refresh, getMe, creds } from '../src/auth.js';

const { phone, password } = creds();
const LOGOUT = '/api/v1/auth/logout';

(phone && password ? describe : describe.skip)('Auth — logout', () => {
  it('logout with a valid token and refresh token succeeds @smoke', async () => {
    const { access_token, refresh_token } = await getTokens();
    await logout(access_token, refresh_token).expect(200);
  });

  it('the access token no longer works after logout', async () => {
    const { access_token, refresh_token } = await getTokens();
    await logout(access_token, refresh_token).expect(200);
    await getMe(access_token).expect(401);
  });

  it('the refresh token no longer works after logout', async () => {
    const { access_token, refresh_token } = await getTokens();
    await logout(access_token, refresh_token).expect(200);
    const res = await refresh(refresh_token).expect(401);
    expect(res.body).to.have.nested.property('error.code', 5006);
  });

  it('logout without a token is rejected even with a valid refresh token in the body', async () => {
    const { refresh_token } = await getTokens();
    const res = await api.post(LOGOUT).send({ refresh_token }).expect(401);
    expect(payload(res)).to.have.nested.property('error.code', 1001);
  });

  it('logging out one session does not log out another session of the same user', async () => {
    const a = await getTokens();
    const b = await getTokens(); // second device
    await logout(a.access_token, a.refresh_token).expect(200);
    await getMe(b.access_token).expect(200); // session B still valid
  });

  it('logging out the same session twice reports the session as already revoked', async () => {
    const { access_token, refresh_token } = await getTokens();
    await logout(access_token, refresh_token).expect(200);
    const res = await logout(access_token, refresh_token).expect(401);
    expect(payload(res)).to.have.nested.property('error.code', 5015);
  });
});
