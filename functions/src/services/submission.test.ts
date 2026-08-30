import {
	ALLOWED_CONTENT_TYPES,
	MAX_SUBMISSION_BYTES,
	SubmissionError,
	canTransition,
	readContributor,
	readSuggestion,
	toPublished,
	validateFile
} from '../../../sharedModels/submission';
import type { Submission } from '../../../sharedModels/submission';
import { bearerToken } from './admin-auth';
import { readCuratorFields } from './submissionService';

describe('readContributor', () => {
	it('keeps a name and a note', () => {
		expect(readContributor({ name: '  Jan   Peeters ', note: 'Dit is de Dorpsstraat' })).toEqual({
			name: 'Jan Peeters',
			note: 'Dit is de Dorpsstraat'
		});
	});

	it('accepts a submission with nothing filled in', () => {
		// Demanding a name before accepting a photograph loses more than it gains.
		expect(readContributor({})).toEqual({});
	});

	it('drops an address that cannot be one', () => {
		// A typo is worse than nothing: it looks like a way to reach the contributor and is not.
		expect(readContributor({ email: 'jan at example' })).toEqual({});
		expect(readContributor({ email: 'jan@example.be' })).toEqual({ email: 'jan@example.be' });
	});

	it('trims what a form can be made to send', () => {
		const contributor = readContributor({ note: 'x'.repeat(5000) });
		expect(contributor.note?.length).toBe(2000);
	});

	it('ignores anything that is not text', () => {
		expect(readContributor({ name: 42, note: { toString: () => 'nope' } })).toEqual({});
	});
});

describe('readSuggestion', () => {
	it('keeps a title, a year and a description', () => {
		expect(
			readSuggestion({ title: ' De bakkerij ', year: 'rond 1950', description: 'Mijn grootvader.' })
		).toEqual({ title: 'De bakkerij', year: 'rond 1950', description: 'Mijn grootvader.' });
	});

	it('keeps a year as free text', () => {
		// "rond 1950" is an answer worth having; the curator turns it into a real year.
		expect(readSuggestion({ year: 'jaren 30' })).toEqual({ year: 'jaren 30' });
	});

	it('returns nothing rather than an empty object', () => {
		expect(readSuggestion({})).toBeUndefined();
		expect(readSuggestion({ title: '   ' })).toBeUndefined();
		expect(readSuggestion('niet een object')).toBeUndefined();
		expect(readSuggestion(null)).toBeUndefined();
	});

	it('trims what a form can be made to send', () => {
		expect(readSuggestion({ description: 'x'.repeat(5000) })?.description?.length).toBe(4000);
		expect(readSuggestion({ year: 'x'.repeat(100) })?.year?.length).toBe(40);
		expect(readSuggestion({ title: 42, description: ['a'] })).toBeUndefined();
	});
});

describe('validateFile', () => {
	it('accepts the formats the archive holds', () => {
		for (const contentType of ALLOWED_CONTENT_TYPES) {
			expect(() => validateFile({ contentType, bytes: 1000 })).not.toThrow();
		}
	});

	it('refuses anything that is not a photograph', () => {
		// The upload form takes files from strangers; a PDF or a script is not a photograph.
		expect(() => validateFile({ contentType: 'application/pdf', bytes: 1000 })).toThrow(
			SubmissionError
		);
		expect(() => validateFile({ contentType: 'text/html', bytes: 1000 })).toThrow(SubmissionError);
	});

	it('refuses an empty file', () => {
		expect(() => validateFile({ contentType: 'image/jpeg', bytes: 0 })).toThrow(SubmissionError);
	});

	it('refuses one larger than the limit', () => {
		expect(() =>
			validateFile({ contentType: 'image/jpeg', bytes: MAX_SUBMISSION_BYTES + 1 })
		).toThrow(SubmissionError);
		expect(() =>
			validateFile({ contentType: 'image/jpeg', bytes: MAX_SUBMISSION_BYTES })
		).not.toThrow();
	});
});

describe('canTransition', () => {
	it('lets a curator decide', () => {
		expect(canTransition('pending', 'approved')).toBe(true);
		expect(canTransition('pending', 'rejected')).toBe(true);
	});

	it('lets a decision be reversed', () => {
		// A photograph published by mistake has to be able to come back off the site.
		expect(canTransition('approved', 'pending')).toBe(true);
		expect(canTransition('rejected', 'pending')).toBe(true);
		expect(canTransition('approved', 'rejected')).toBe(true);
	});

	it('refuses to decide the same way twice', () => {
		// Two curators reviewing the same photograph must not both publish it.
		expect(canTransition('approved', 'approved')).toBe(false);
		expect(canTransition('pending', 'pending')).toBe(false);
	});
});

describe('readCuratorFields', () => {
	it('takes the fields a curator may set', () => {
		expect(
			readCuratorFields({
				title: 'Dorpsstraat 12',
				places: ['dorpsstraat'],
				houseNumber: 12,
				year: '1935',
				donor: 'Jan Peeters',
				lat: 51.3,
				lng: 4.4
			})
		).toEqual({
			title: 'Dorpsstraat 12',
			places: ['dorpsstraat'],
			houseNumber: 12,
			year: '1935',
			donor: 'Jan Peeters',
			lat: 51.3,
			lng: 4.4
		});
	});

	it('ignores everything else the request carried', () => {
		// The body is parsed as a whole; only the listed fields may reach the database, or a
		// crafted request could rewrite the status or the reviewer.
		expect(
			readCuratorFields({ status: 'approved', reviewedBy: 'someone@else', id: 'other' })
		).toEqual({});
		// A suggestion is the contributor's; a review may adopt its text into `description`,
		// but the request cannot write the suggestion record itself.
		expect(readCuratorFields({ suggestion: { title: 'x' } })).toEqual({});
	});

	it('takes a description, trimmed and capped', () => {
		expect(readCuratorFields({ description: '  Het café op de hoek. ' })).toEqual({
			description: 'Het café op de hoek.'
		});
		expect(readCuratorFields({ description: 'x'.repeat(5000) }).description?.length).toBe(4000);
	});

	it('refuses a year that is not one', () => {
		expect(readCuratorFields({ year: 'ergens in de jaren 30' })).toEqual({});
		expect(readCuratorFields({ year: '1935-1936' })).toEqual({ year: '1935-1936' });
	});

	it('refuses a half coordinate', () => {
		expect(readCuratorFields({ lat: 51.3 })).toEqual({});
	});

	it('refuses a house number that is not a whole number', () => {
		expect(readCuratorFields({ houseNumber: 12.5 })).toEqual({});
		expect(readCuratorFields({ houseNumber: '12' })).toEqual({});
	});
});

describe('toPublished', () => {
	const submission: Submission = {
		id: 'abc',
		status: 'approved',
		storagePath: 'archief/abc.jpg',
		originalName: 'Dorpsstraat 1935.jpg',
		contentType: 'image/jpeg',
		bytes: 1000,
		contributor: { name: 'Jan Peeters', email: 'jan@example.be', note: 'van mijn grootmoeder' },
		submittedAt: '2026-01-01T00:00:00.000Z',
		reviewedAt: '2026-01-02T00:00:00.000Z',
		reviewedBy: 'curator@example.be'
	};

	it("never lets the contributor's email reach the website", () => {
		// The single most important line in this file.
		const published = toPublished(submission, 'https://example/abc.jpg');
		expect(JSON.stringify(published)).not.toContain('jan@example.be');
		expect(JSON.stringify(published)).not.toContain('curator@example.be');
		expect(JSON.stringify(published)).not.toContain('van mijn grootmoeder');
	});

	it('falls back to the filename when a curator set no title', () => {
		expect(toPublished(submission, 'x').title).toBe('Dorpsstraat 1935');
	});

	it('credits the contributor when no donor was recorded', () => {
		expect(toPublished(submission, 'x').donor).toBe('Jan Peeters');
	});

	it("prefers the curator's donor over the contributor's name", () => {
		expect(toPublished({ ...submission, donor: 'Heemkring' }, 'x').donor).toBe('Heemkring');
	});

	it('omits a coordinate rather than sending half of one', () => {
		const published = toPublished({ ...submission, lat: 51.3 }, 'x');
		expect(published.lat).toBeUndefined();
		expect(published.lng).toBeUndefined();
	});

	it("publishes the curator's description, never the contributor's suggestion", () => {
		const withSuggestion: Submission = {
			...submission,
			suggestion: { title: 'ongelezen titel', year: 'rond 1950', description: 'ongelezen tekst' }
		};

		// The suggestion prefills the curator's form; publishing it is a decision, not a
		// default. A suggestion that was never adopted must not appear anywhere public.
		expect(JSON.stringify(toPublished(withSuggestion, 'x'))).not.toContain('ongelezen');

		const adopted = toPublished({ ...withSuggestion, description: 'Gelezen en overgenomen.' }, 'x');
		expect(adopted.description).toBe('Gelezen en overgenomen.');
	});
});

describe('bearerToken', () => {
	it('reads a bearer token', () => {
		expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
		expect(bearerToken('bearer   abc')).toBe('abc');
	});

	it('returns nothing for anything else', () => {
		expect(bearerToken(undefined)).toBeNull();
		expect(bearerToken('')).toBeNull();
		expect(bearerToken('abc.def.ghi')).toBeNull();
		expect(bearerToken('Basic abc')).toBeNull();
	});
});
