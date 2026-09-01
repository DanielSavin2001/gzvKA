import {
	editDistance,
	likelyDuplicates,
	type DonorLike
} from '../../../sharedModels/donor-similarity';

/**
 * Two spellings of one person, and the harder half: two people who look like one.
 *
 * This drives a merge button. A false pair here does not waste a curator's time, it invites
 * them to fuse two real residents into one page - and the photographs are of somebody's
 * family. So the cases that must NOT match matter more than the ones that must.
 */

const donor = (name: string, count = 1): DonorLike => ({
	slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
	name,
	count
});

describe('editDistance', () => {
	it('is zero for the same string', () => {
		expect(editDistance('vingerhoed', 'vingerhoed')).toBe(0);
	});

	it('counts one insertion', () => {
		expect(editDistance('doncker', 'donckers')).toBe(1);
	});

	it('gives up past the limit rather than counting on', () => {
		// The cap is what keeps this cheap across 295 donors, which is 43,365 pairs.
		expect(editDistance('kort', 'volstrekt iets anders', 2)).toBe(3);
	});
});

describe('likelyDuplicates', () => {
	it('finds the same words in a different order', () => {
		// The real one: the archive's biggest donor, 362 photographs against 2.
		const pairs = likelyDuplicates([donor('Swatti Alix', 362), donor('Alix Swatti', 2)]);

		expect(pairs).toHaveLength(1);
		expect(pairs[0].why).toBe('zelfde-woorden');
	});

	it('finds a name shortened to an initial', () => {
		const pairs = likelyDuplicates([donor('Viviane Van Alphen', 1), donor('Viviane Van A', 12)]);

		expect(pairs).toHaveLength(1);
		expect(pairs[0].why).toBe('initiaal');
	});

	it('finds a mistyped surname', () => {
		const pairs = likelyDuplicates([
			donor('Heemkring Hoghescote', 328),
			donor('Heemkring Hogeschote', 20)
		]);

		expect(pairs).toHaveLength(1);
		expect(pairs[0].why).toBe('tikfout');
	});

	it('refuses two different first names behind one surname', () => {
		// Both pairs are really in this archive. Robert Vingerhoed has 132 photographs and
		// Roger has 1; offering them as a merge would lose a man.
		expect(
			likelyDuplicates([donor('Robert Vingerhoed', 132), donor('Roger Vingerhoed', 1)])
		).toHaveLength(0);
		expect(likelyDuplicates([donor('Stan Wagemans', 14), donor('Jean Wagemans', 1)])).toHaveLength(
			0
		);
	});

	it('still keeps a first name that is one character out', () => {
		// The line is drawn at two characters: "Mariane" is a slip, "Roger" is a name.
		const pairs = likelyDuplicates([
			donor('Marianne Verschueren', 50),
			donor('Mariane Verschueren', 3)
		]);

		expect(pairs).toHaveLength(1);
	});

	it('does not pair two plainly different people', () => {
		expect(likelyDuplicates([donor('Jan Verhelst', 167), donor('Hugo De Hoon', 155)])).toHaveLength(
			0
		);
	});

	it('puts the pair with the most photographs at stake first', () => {
		const pairs = likelyDuplicates([
			donor('Danielle De Dooij', 1),
			donor('Danielle De Dooy', 1),
			donor('Swatti Alix', 362),
			donor('Alix Swatti', 2)
		]);

		expect(pairs[0].a.count + pairs[0].b.count).toBe(364);
	});

	it('still catches a typo in a one-word name', () => {
		// The guard against two different given names needs two words to reason about. A
		// single word has no given name to confuse, and plenty of donors here are one word
		// because they are organisations rather than people - a heemkring, a university.
		expect(likelyDuplicates([donor('Hoghescote'), donor('Hogeschote')])).toHaveLength(1);
	});

	it('reads an abbreviated organisation as the same one', () => {
		// Really in the archive: "U Gent" and "Universiteit Gent", one photograph each.
		const pairs = likelyDuplicates([donor('U Gent', 2), donor('Universiteit Gent', 2)]);

		expect(pairs).toHaveLength(1);
		expect(pairs[0].why).toBe('initiaal');
	});
});
