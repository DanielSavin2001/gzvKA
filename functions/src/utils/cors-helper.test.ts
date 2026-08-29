import { isAllowedOrigin } from './cors-helper';

/**
 * The origin rule decides whether the browser hands a response to the page at all, so a
 * mistake here does not look like a security problem - it looks like the server is down.
 */
describe('isAllowedOrigin', () => {
	const environment = process.env;

	beforeEach(() => {
		process.env = { ...environment, GCLOUD_PROJECT: 'gzvka-12a9f' };
		delete process.env.GZVKA_ALLOWED_ORIGINS;
	});

	afterAll(() => {
		process.env = environment;
	});

	it('allows the live site and local development', () => {
		expect(isAllowedOrigin('https://gzvka.com')).toBe(true);
		expect(isAllowedOrigin('https://www.gzvka.com')).toBe(true);
		expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
	});

	it("allows the project's own hosting domains", () => {
		expect(isAllowedOrigin('https://gzvka-12a9f.web.app')).toBe(true);
		expect(isAllowedOrigin('https://gzvka-12a9f.firebaseapp.com')).toBe(true);
	});

	it('allows a pull request preview channel', () => {
		// The URL this branch is actually reviewed on.
		expect(isAllowedOrigin('https://gzvka-12a9f--pr40-claude-gzvka-revamp-gnv43t72.web.app')).toBe(
			true
		);
	});

	it('refuses another project on the same hosting domain', () => {
		expect(isAllowedOrigin('https://someone-else.web.app')).toBe(false);
		expect(isAllowedOrigin('https://gzvka-12a9f-evil.web.app')).toBe(false);
	});

	it('refuses a host that merely ends with an allowed one', () => {
		expect(isAllowedOrigin('https://evil-gzvka.com')).toBe(false);
		expect(isAllowedOrigin('https://gzvka.com.evil.test')).toBe(false);
		expect(isAllowedOrigin('https://gzvka-12a9f.web.app.evil.test')).toBe(false);
	});

	it('refuses plain http for a deployed domain', () => {
		expect(isAllowedOrigin('http://gzvka.com')).toBe(false);
		expect(isAllowedOrigin('http://gzvka-12a9f.web.app')).toBe(false);
	});

	it('follows the project it is deployed in', () => {
		process.env.GCLOUD_PROJECT = 'another-project';
		expect(isAllowedOrigin('https://another-project.web.app')).toBe(true);
		expect(isAllowedOrigin('https://gzvka-12a9f.web.app')).toBe(false);
	});

	it('accepts extra origins named by the deployment', () => {
		process.env.GZVKA_ALLOWED_ORIGINS = 'https://archief.kapellen.be, https://staging.test';
		expect(isAllowedOrigin('https://archief.kapellen.be')).toBe(true);
		expect(isAllowedOrigin('https://staging.test')).toBe(true);
		expect(isAllowedOrigin('https://not-listed.test')).toBe(false);
	});
});
