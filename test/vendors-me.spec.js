import { expect } from 'chai';
import { api, bearer } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/vendors/me';

// Top-level keys of the profile contract (observed). `emploee_profile` is the API's spelling.
const TOP_KEYS = [
  'profile', 'name', 'business_name', 'lang', 'email', 'phone', 'address', 'logo',
  'business_logo', 'display_id', 'contract', 'balance', 'is_business', 'is_corporate',
  'legal_form', 'rejected_at', 'requested_business', 'callback', 'door_to_door_required',
  'emploee_profile', 'new_client_count',
];

(phone && password ? describe : describe.skip)('Vendors — me', () => {
  let me;
  before(async () => {
    const token = (await getTokens()).access_token;
    me = (await api.get(URL).set('Authorization', bearer(token)).expect(200)).body;
  });

  it('returns the full profile contract for the logged-in account @smoke', () => {
    expect(me).to.include.all.keys(TOP_KEYS);
    expect(me.phone, 'phone matches the login').to.equal(phone);
    for (const k of ['name', 'business_name', 'lang', 'email', 'address', 'logo', 'business_logo', 'display_id'])
      expect(me[k], k).to.be.a('string');
    expect(me.lang, 'lang').to.not.be.empty;
    expect(me.display_id, 'display_id').to.not.be.empty;
  });

  it('exposes the profile block with a role', () => {
    expect(me.profile).to.include.all.keys(['role', 'first_name', 'last_name']);
    expect(me.profile.role, 'role').to.be.a('string').and.match(/^[A-Z_]+$/); // e.g. VENDOR_ADMIN
    for (const k of ['first_name', 'last_name'])
      expect(me.profile[k], `profile.${k}`).to.satisfy((v) => v === null || typeof v === 'string');
  });
});
