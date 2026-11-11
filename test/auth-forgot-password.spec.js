import { expect } from 'chai';
import { api } from '../src/client.js';
import { login, unwrap } from '../src/auth.js';

// Forgot-password flow: OTP send -> confirm -> set new password -> log in with it.
//
// The OTP is only delivered by SMS and is NOT returned by the API, so this flow
// cannot run with an ordinary account. It is gated on a DEDICATED test number whose
// OTP the backend fixes in the test env. Set these once the backend provides them
// (.env locally, or CI secrets) — the test skips itself until both are present:
//   RESET_PHONE=+998........      the test number
//   RESET_OTP=000000             its fixed OTP in the test env
//   RESET_NEW_PASSWORD=...       password the flow will set (optional; default below)
const phone = process.env.RESET_PHONE;
const otp = process.env.RESET_OTP;
const newPassword = process.env.RESET_NEW_PASSWORD || 'Noor-Reset-1!';
const PURPOSE = 'OTP_PURPOSE_SET_PASSWORD';

(phone && otp ? describe : describe.skip)('Auth — forgot password @smoke', () => {
  it('sends an OTP, confirms it, sets a new password, and logs in with it', async () => {
    // 1. request an OTP SMS. 200 normally; inside the ~5-min resend window the backend
    //    may reject a repeat send — the fixed OTP still confirms, so don't hard-fail here.
    const sent = await api.post('/api/v1/otp/send').send({ phone, app: 'merchant', language: 'uz' });
    expect([200, 400, 429], `otp/send: ${sent.text}`).to.include(sent.status);

    // 2. confirm the (fixed) OTP -> confirmation_id
    const confirmed = await api.post('/api/v1/otp/confirm').send({ phone, otp, purpose: PURPOSE });
    expect(confirmed.status, `otp/confirm: ${confirmed.text}`).to.equal(200);
    const { confirmation_id } = unwrap(confirmed.body);
    expect(confirmation_id, 'confirmation_id').to.be.a('string').and.not.empty;

    // 3. set the new password with that confirmation
    const set = await api
      .post('/api/v1/auth/merchants/set-password')
      .send({ confirmation_id, new_password: newPassword });
    expect(set.status, `set-password: ${set.text}`).to.equal(200);

    // 4. the new password now logs in
    const relogin = await login(phone, newPassword);
    expect(relogin.status, `re-login: ${relogin.text}`).to.equal(200);
    expect(unwrap(relogin.body).access_token, 'access_token after reset').to.be.a('string').and.not.empty;
  });
});
