import { expect } from 'chai';
import { getTokens, refresh, creds, unwrap } from '../src/auth.js';

const { phone, password } = creds();

(phone && password ? describe : describe.skip)('Auth — refresh', () => {
  it('a valid refresh token returns a new rotated token pair @smoke', async () => {
    const { refresh_token } = await getTokens();
    const res = await refresh(refresh_token).expect(200);
    const data = unwrap(res.body);
    expect(data.access_token, 'new access_token').to.be.a('string').and.not.empty;
    expect(data.refresh_token, 'new refresh_token').to.be.a('string').and.not.empty;
    expect(data.refresh_token, 'refresh token is rotated').to.not.equal(refresh_token);
  });

  it('a refresh token cannot be reused after it has been rotated', async () => {
    const { refresh_token } = await getTokens();
    await refresh(refresh_token).expect(200); // first use rotates it
    const res = await refresh(refresh_token).expect(401); // second use rejected
    expect(res.body).to.have.nested.property('error.code', 5006);
  });

  it('an invalid refresh token is rejected', async () => {
    const res = await refresh('not-a-real-token').expect(401);
    expect(res.body).to.have.nested.property('error.code', 5006);
    expect(res.body.error.message).to.equal('invalid token');
  });

  it('an access token used as a refresh token is rejected', async () => {
    const { access_token } = await getTokens();
    const res = await refresh(access_token).expect(401);
    expect(res.body).to.have.nested.property('error.code', 5006);
  });
});
