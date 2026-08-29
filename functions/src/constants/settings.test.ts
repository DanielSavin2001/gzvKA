import { getBucketName, resetSettingsCache } from './google-storage-constants';

/**
 * The bucket name is a constant nobody looks at until a photograph fails to load, and by
 * then it looks like a bug in the upload path. It is worth a test of its own.
 */
describe('getBucketName', () => {
	const environment = process.env;

	beforeEach(() => {
		process.env = { ...environment };
		delete process.env.GZVKA_BUCKET_NAME;
		resetSettingsCache();
	});

	afterAll(() => {
		process.env = environment;
		resetSettingsCache();
	});

	it("falls back to the project's real default bucket", () => {
		// Not "gzvka.appspot.com": that is the project id with its suffix missing, and no
		// such bucket exists.
		expect(getBucketName()).toBe('gzvka-12a9f.appspot.com');
	});

	it('lets the environment override it', () => {
		process.env.GZVKA_BUCKET_NAME = 'somewhere-else.appspot.com';
		expect(getBucketName()).toBe('somewhere-else.appspot.com');
	});
});
