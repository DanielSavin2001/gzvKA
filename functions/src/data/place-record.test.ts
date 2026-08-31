import {
	CURATOR_KINDS,
	PlaceRecordError,
	placeIdFrom,
	readPlaceRecord,
	isStreetKind,
	withPlaceRecords,
	wouldLoop,
	type MergeablePlace,
	type PlaceRecord
} from '../../../sharedModels/place-record';

/**
 * Creating a place without a deploy.
 *
 * Everything a curator types here becomes an id that photographs, pins and eventually the
 * committed gazetteer all point at, so the reader is the only thing between a typo and a
 * place nothing can find again.
 */

describe('placeIdFrom', () => {
	it('matches what the gazetteer build would produce', () => {
		expect(placeIdFrom('Kasteel Appel')).toBe('kasteel-appel');
		expect(placeIdFrom('Café De Vrede')).toBe('cafe-de-vrede');
		expect(placeIdFrom('  Station   Kapellen  ')).toBe('station-kapellen');
	});

	it('leaves nothing usable when there is nothing to slug', () => {
		expect(placeIdFrom('!!!')).toBe('');
	});
});

describe('readPlaceRecord', () => {
	it('takes a name and derives everything it can', () => {
		const record = readPlaceRecord({ name: 'Kasteel Appel', kind: 'castle-estate' });

		expect(record).toEqual({ id: 'kasteel-appel', name: 'Kasteel Appel', kind: 'castle-estate' });
	});

	it('honours an explicit id, so an existing place can be corrected', () => {
		// Renaming must not move the id: photographs, pins and the sitemap all point at it.
		const record = readPlaceRecord({
			id: 'kasteel-oude-gracht',
			name: 'Kasteel Oude Gracht (afgebroken 1952)',
			kind: 'castle-estate'
		});

		expect(record.id).toBe('kasteel-oude-gracht');
	});

	it('refuses a nameless place', () => {
		expect(() => readPlaceRecord({ kind: 'area' })).toThrow(PlaceRecordError);
		expect(() => readPlaceRecord({ name: '   ', kind: 'area' })).toThrow(PlaceRecordError);
	});

	it('refuses a name that slugs to nothing', () => {
		expect(() => readPlaceRecord({ name: '???', kind: 'area' })).toThrow(PlaceRecordError);
	});

	it('refuses a kind it does not know, rather than filing the place arbitrarily', () => {
		expect(() => readPlaceRecord({ name: 'Iets', kind: 'kasteel' })).toThrow(PlaceRecordError);
		// 'person' is a real gazetteer kind and still not one to create more of.
		expect(() => readPlaceRecord({ name: 'Iemand', kind: 'person' })).toThrow(PlaceRecordError);
	});

	it('refuses a place that is its own parent', () => {
		expect(() =>
			readPlaceRecord({ name: 'Station Kapellen', kind: 'building', parentId: 'station-kapellen' })
		).toThrow(PlaceRecordError);
	});

	it('keeps a parent that is somewhere else', () => {
		const record = readPlaceRecord({
			name: 'Begin van de straat',
			kind: 'area',
			parentId: 'station-kapellen'
		});

		expect(record.parentId).toBe('station-kapellen');
	});

	it('refuses a district it does not know', () => {
		expect(() => readPlaceRecord({ name: 'Iets', kind: 'area', district: 'brussel' })).toThrow(
			PlaceRecordError
		);
	});
});

describe('wouldLoop', () => {
	it('is false for a plain chain', () => {
		const records = { b: { parentId: 'c' }, c: {} };
		expect(wouldLoop('a', 'b', records)).toBe(false);
	});

	it('catches the two-click loop: A under B, then B under A', () => {
		const records = { a: { parentId: 'b' }, b: {} };
		expect(wouldLoop('b', 'a', records)).toBe(true);
	});

	it('catches a longer way round', () => {
		const records = { a: { parentId: 'b' }, b: { parentId: 'c' }, c: {} };
		expect(wouldLoop('c', 'a', records)).toBe(true);
	});

	it('does not hang on a loop that is already stored', () => {
		// Defensive: if a loop ever got in, asking about it must still answer.
		const records = { a: { parentId: 'b' }, b: { parentId: 'a' } };
		expect(wouldLoop('x', 'a', records)).toBe(true);
	});
});

describe('isStreetKind', () => {
	it('agrees with the gazetteer across every kind a curator can choose', () => {
		// In the shipped gazetteer isStreet is true for exactly street and square, over all
		// 131 entries. Deriving it keeps the two from ever disagreeing.
		const streets = CURATOR_KINDS.filter(isStreetKind);
		expect(streets).toEqual(['street', 'square']);
	});
});

describe('withPlaceRecords', () => {
	const generated: MergeablePlace[] = [
		{
			id: 'dorpsstraat',
			name: 'Dorpsstraat',
			kind: 'street',
			district: 'kapellen',
			isStreet: true,
			count: 12
		}
	];

	const record = (over: Partial<PlaceRecord> & Pick<PlaceRecord, 'id' | 'name' | 'kind'>) =>
		({ by: 'curator@example.com', on: '2026-08-31', ...over } as PlaceRecord);

	it('leaves the generated places alone when there is no overlay', () => {
		expect(withPlaceRecords(generated, {})).toEqual(generated);
	});

	it('adds a place the gazetteer has never heard of', () => {
		const merged = withPlaceRecords(generated, {
			'kasteel-appel': record({ id: 'kasteel-appel', name: 'Kasteel Appel', kind: 'castle-estate' })
		});

		expect(merged).toHaveLength(2);
		expect(merged[1]).toMatchObject({
			id: 'kasteel-appel',
			name: 'Kasteel Appel',
			isStreet: false,
			district: 'unknown',
			count: 0
		});
	});

	it('corrects a place the gazetteer already knows, without touching its count', () => {
		// The count comes from the photographs a moment later; an overlay must never carry
		// its own, or a page says 12 over a grid of 217.
		const merged = withPlaceRecords(generated, {
			dorpsstraat: record({ id: 'dorpsstraat', name: 'Dorpstraat (oude spelling)', kind: 'street' })
		});

		expect(merged).toHaveLength(1);
		expect(merged[0].name).toBe('Dorpstraat (oude spelling)');
		expect(merged[0].count).toBe(12);
	});

	it('derives isStreet from the corrected kind rather than keeping the old one', () => {
		// The browse family reads kind AND isStreet. Correcting one and not the other would
		// file the place in one list and colour it as another.
		const merged = withPlaceRecords(generated, {
			dorpsstraat: record({ id: 'dorpsstraat', name: 'Dorpsplein', kind: 'square' })
		});
		expect(merged[0].isStreet).toBe(true);

		const toBuilding = withPlaceRecords(generated, {
			dorpsstraat: record({ id: 'dorpsstraat', name: 'Het oude gemeentehuis', kind: 'building' })
		});
		expect(toBuilding[0].isStreet).toBe(false);
	});

	it('carries a parent through, on a new place and on a corrected one', () => {
		const merged = withPlaceRecords(generated, {
			'begin-van-de-straat': record({
				id: 'begin-van-de-straat',
				name: 'Begin van de straat',
				kind: 'area',
				parentId: 'dorpsstraat'
			})
		});

		expect(merged.find((place) => place.id === 'begin-van-de-straat')?.parentId).toBe(
			'dorpsstraat'
		);
	});

	it('keeps the district the build knows when the record does not name one', () => {
		const merged = withPlaceRecords(generated, {
			dorpsstraat: record({ id: 'dorpsstraat', name: 'Dorpsstraat', kind: 'street' })
		});

		expect(merged[0].district).toBe('kapellen');
	});
});
