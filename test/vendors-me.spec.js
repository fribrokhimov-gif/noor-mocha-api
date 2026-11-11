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

  it('reports business flags and legal form', () => {
    for (const k of ['is_business', 'is_corporate', 'requested_business', 'door_to_door_required'])
      expect(me[k], k).to.be.a('boolean');
    expect(me.legal_form, 'legal_form').to.be.a('string').and.match(/^LEGAL_FORM_/);
    expect(me.rejected_at, 'rejected_at').to.satisfy((v) => v === null || typeof v === 'string');
    expect(me.callback, 'callback').to.satisfy((v) => v === null || typeof v === 'object');
  });

  it('includes a contract block with a start date', () => {
    expect(me.contract).to.include.all.keys(['number', 'start_date', 'document']);
    expect(me.contract.start_date, 'start_date').to.be.a('string');
    expect(Number.isNaN(Date.parse(me.contract.start_date)), 'start_date is a valid date').to.be.false;
    for (const k of ['number', 'document'])
      expect(me.contract[k], `contract.${k}`).to.satisfy((v) => v === null || typeof v === 'string');
  });

  it('includes a balance block (current can be negative)', () => {
    expect(me.balance).to.include.all.keys(['current', 'minimal', 'restriction_enabled']);
    expect(me.balance.current, 'balance.current').to.be.a('number');
    expect(me.balance.minimal, 'balance.minimal').to.be.a('number');
    expect(me.balance.restriction_enabled, 'restriction_enabled').to.be.a('boolean');
  });

  it('embeds an employee profile that mirrors the account', () => {
    const ep = me.emploee_profile; // API spelling
    expect(ep).to.include.all.keys(['business_name', 'balance', 'is_corporate', 'legal_form', 'id', 'role', 'token']);
    expect(ep.id, 'emploee_profile.id').to.be.a('number');
    expect(ep.role, 'emploee_profile.role').to.be.a('string').and.not.empty;
    expect(ep.business_name, 'mirrors business_name').to.equal(me.business_name);
    expect(ep.balance).to.include.all.keys(['current', 'minimal', 'restriction_enabled']);
    // NOTE: the profile response embeds a full access token — flagged to backend/security.
    expect(ep.token, 'emploee_profile.token is a JWT').to.be.a('string');
    expect(ep.token.split('.'), 'JWT has three parts').to.have.length(3);
  });

  it('reports a non-negative new-client count', () => {
    expect(me.new_client_count, 'new_client_count').to.be.a('number').and.at.least(0);
  });
});
