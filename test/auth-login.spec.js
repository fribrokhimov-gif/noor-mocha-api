import { expect } from 'chai';
import { api } from '../src/client.js';
import { login, creds, unwrap } from '../src/auth.js';

const { phone, password } = creds();
const ENDPOINT = '/api/v1/auth/merchant';

// Decode a JWT payload without a dependency (base64url -> JSON).
const jwtClaims = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

(phone && password ? describe : describe.skip)('Auth — login', () => {
  it('valid credentials return access and refresh tokens @smoke', async () => {
    const res = await login(phone, password).expect(200);
    const data = unwrap(res.body);
    expect(data.access_token, 'access_token').to.be.a('string').and.not.empty;
    expect(data.refresh_token, 'refresh_token').to.be.a('string').and.not.empty;
    expect(data.access_token.split('.')).to.have.length(3); // JWT shape
  });

  it('access token is a JWT that expires in 5 minutes', async () => {
    const res = await login(phone, password).expect(200);
    const claims = jwtClaims(unwrap(res.body).access_token);
    expect(claims.type, 'token type').to.equal('access');
    expect(claims.exp - claims.iat, 'TTL seconds').to.equal(300); // 5 min (observed)
  });

  it('incorrect password is rejected', async () => {
    const res = await login(phone, 'Wrong-Password-123').expect(401);
    expect(res.body).to.have.nested.property('error.code', 5001);
    expect(res.body.error.message).to.equal('invalid credentials');
  });

  it('unknown phone number returns the same error as a wrong password (no user enumeration)', async () => {
    const res = await login('+998000000001', 'Whatever-123').expect(401);
    expect(res.body).to.have.nested.property('error.code', 5001); // identical to wrong-password
  });

  it('password with wrong letter-casing is rejected', async () => {
    const res = await login(phone, password.toUpperCase()).expect(401);
    expect(res.body).to.have.nested.property('error.code', 5001);
  });

  it('password with a trailing space is rejected', async () => {
    const res = await login(phone, `${password} `).expect(401);
    expect(res.body).to.have.nested.property('error.code', 5001);
  });

  it('missing password returns a validation error', async () => {
    const res = await api.post(ENDPOINT).send({ phone }).expect(400);
    expect(res.body).to.have.nested.property('error.code', 5000);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).to.include('password');
  });

  it('missing phone returns a validation error', async () => {
    const res = await api.post(ENDPOINT).send({ password }).expect(400);
    expect(res.body).to.have.nested.property('error.code', 5000);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).to.include('phone');
  });

  it('empty body reports both fields as required', async () => {
    const res = await api.post(ENDPOINT).send({}).expect(400);
    expect(res.body).to.have.nested.property('error.code', 5000);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).to.include.members(['phone', 'password']);
  });

  it('malformed phone returns a phone validation error', async () => {
    const res = await api.post(ENDPOINT).send({ phone: 'abc', password: 'x' }).expect(400);
    expect(res.body).to.have.nested.property('error.code', 5000);
    const detail = res.body.error.details.find((d) => d.field === 'phone');
    expect(detail, 'phone detail').to.exist;
    expect(detail.issue).to.match(/Uzbek phone number/i);
  });

  it('numeric field types return an invalid-input error', async () => {
    const res = await api.post(ENDPOINT).send({ phone: 998938123231, password: 12345678 }).expect(400);
    expect(res.body).to.have.nested.property('error.code', 1006); // distinct from 5000 "validation failed"
  });
});
