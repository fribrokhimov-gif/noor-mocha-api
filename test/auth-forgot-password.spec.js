import { expect } from 'chai';
import { employeesApi, bearer } from '../src/client.js';
import { getTokens, creds, login, unwrap, sendOtp, confirmOtp, setPassword } from '../src/auth.js';

const { phone, password } = creds();
// forgot-password only works for a registered user (otp/send on an unknown number -> 404), so the
// test provisions a throwaway employee first. The test env fixes the OTP for +99800 numbers.
const OTP = process.env.EMPLOYEE_TEST_OTP;
const EPATH = '/merchant-employees';
const newPhone = () => `+99800${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
const OLD_PASSWORD = 'Noor-Old-Qa1!';
const NEW_PASSWORD = '4!2Xs>qd*[6)';
const unwrapEmployee = (body) => body?.data?.employee ?? body?.data ?? body;

(phone && password && OTP ? describe : describe.skip)('Auth — forgot password (OTP reset)', () => {
  let auth, emp;
  const empPhone = newPhone();

  // Reset the employee's password via the OTP flow: otp/send -> otp/confirm -> set-password.
  async function resetPassword(newPassword) {
    await sendOtp(empPhone).expect(200);
    const confirmed = await confirmOtp(empPhone, OTP).expect(200);
    const { confirmation_id } = unwrap(confirmed.body);
    expect(confirmation_id, 'confirmation_id').to.be.a('string').and.not.empty;
    await setPassword(confirmation_id, newPassword).expect(200);
  }

  before(async () => {
    auth = { Authorization: bearer((await getTokens()).access_token) };
    // provision a registered user and give them an initial password
    const res = await employeesApi
      .post(EPATH).set(auth)
      .send({ new_identity: { phone: empPhone, role: 'manager', first_name: 'QA', last_name: 'Forgot' } })
      .expect(200);
    emp = unwrapEmployee(res.body);
    await resetPassword(OLD_PASSWORD);
    expect((await login(empPhone, OLD_PASSWORD)).status, 'initial login works').to.equal(200);
  });

  after(async () => {
    if (emp?.employee_id) await employeesApi.delete(`${EPATH}/${emp.employee_id}`).set(auth);
  });

  it('resets a forgotten password via OTP: the new password works, the old one stops @smoke', async () => {
    await resetPassword(NEW_PASSWORD);
    const res = await login(empPhone, NEW_PASSWORD).expect(200);
    expect(unwrap(res.body).access_token, 'access_token with the new password').to.be.a('string').and.not.empty;
    expect((await login(empPhone, OLD_PASSWORD)).status, 'old password no longer works').to.equal(401);
  });
});
