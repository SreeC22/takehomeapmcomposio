const assert = require('node:assert/strict');
const {
  isDeveloperOAuthRegistrationDoc,
  classifyRegistrationFreeText
} = require('../api/research');

const fixture = (url, text='Create an OAuth app in the developer portal') => ({url, text});
assert.equal(isDeveloperOAuthRegistrationDoc(
  fixture('https://baserow.io/user-docs/configure-github-for-oauth-2-sso'), 'baserow', 'baserow.io'), false,
  'GitHub SSO setup is not Baserow customer API OAuth registration');
assert.equal(isDeveloperOAuthRegistrationDoc(
  fixture('https://developers.example.com/handbook/engineering/oauth-development-guide'), 'example','example.com'), false,
  'Internal engineering handbook is not a customer registration guide');
assert.equal(isDeveloperOAuthRegistrationDoc(
  fixture('https://docs.attio.com/rest-api/tutorials/connect-an-app-through-oauth'), 'attio','attio.com'), true,
  'Official provider OAuth tutorial is a valid starting point');
assert.equal(isDeveloperOAuthRegistrationDoc(
  fixture('https://developers.pipedrive.com/docs/api/v1/Oauth'), 'pipedrive','pipedrive.com'), true,
  'Official provider OAuth reference can be used as documentation, not portal');
assert.equal(isDeveloperOAuthRegistrationDoc(
  fixture('https://not-attio.com/developer/oauth'), 'attio','attio.com'), false,
  'Other-provider links cannot be used for app registration');
assert.equal(classifyRegistrationFreeText('Dynamic client registration via POST /oauth/register/').status, 'conditional',
  'Dynamic client registration must not be described as no registration');
assert.equal(classifyRegistrationFreeText('No registration required for the metadata document flow').status, 'not_applicable');
assert.equal(classifyRegistrationFreeText('Registration is not required for the metadata document flow').status, 'not_applicable');
console.log('Final QA registration and SSO regression: PASS');
