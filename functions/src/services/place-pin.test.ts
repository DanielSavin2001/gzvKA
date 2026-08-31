import {
	PlacePinError,
	readPlacePin,
	readPlacePinRemoval
} from '../../../sharedModels/place-pin';

describe('readPlacePin', () => {
	it('reads a pin and rounds it to about a metre', () => {
		expect(readPlacePin({ placeId: 'kasteel-oude-gracht', lat: 51.3232391, lng: 4.4696201 })).toEqual(
			{
				placeId: 'kasteel-oude-gracht',
				lat: 51.32324,
				lng: 4.46962
			}
		);
	});

	it('refuses anything that is not a gazetteer-shaped id', () => {
		// The id becomes a Firestore document path, so it must never be attacker-shaped.
		for (const placeId of ['', '  ', 'Kasteel Oude Gracht', '../admins', 'a/b', 'x'.repeat(81)]) {
			expect(() => readPlacePin({ placeId, lat: 51.3, lng: 4.4 })).toThrow(PlacePinError);
		}
	});

	it('refuses a coordinate that is not one', () => {
		expect(() => readPlacePin({ placeId: 'klein-bos', lat: 'noord', lng: 4.4 })).toThrow(
			PlacePinError
		);
		expect(() => readPlacePin({ placeId: 'klein-bos', lat: NaN, lng: 4.4 })).toThrow(PlacePinError);
		expect(() => readPlacePin({ placeId: 'klein-bos', lat: 91, lng: 4.4 })).toThrow(PlacePinError);
		expect(() => readPlacePin({ placeId: 'klein-bos', lat: 51.3, lng: 181 })).toThrow(
			PlacePinError
		);
		expect(() => readPlacePin({ placeId: 'klein-bos' })).toThrow(PlacePinError);
	});

	it('refuses the values Number() would quietly turn into the equator', () => {
		// Number(null), Number('') and Number([]) are all 0 - finite, in range, and wrong.
		expect(() => readPlacePin({ placeId: 'klein-bos', lat: null, lng: 4.4 })).toThrow(
			PlacePinError
		);
		expect(() => readPlacePin({ placeId: 'klein-bos', lat: 51.3, lng: '' })).toThrow(PlacePinError);
		expect(() => readPlacePin({ placeId: 'klein-bos', lat: [], lng: 4.4 })).toThrow(PlacePinError);
		expect(() => readPlacePin({ placeId: 'klein-bos', lat: '51.3', lng: 4.4 })).toThrow(
			PlacePinError
		);
	});
});

describe('readPlacePinRemoval', () => {
	it('reads the id and nothing else', () => {
		expect(readPlacePinRemoval({ placeId: 'cafe-de-vrede', remove: true })).toBe('cafe-de-vrede');
	});

	it('refuses a missing or malformed id', () => {
		expect(() => readPlacePinRemoval({})).toThrow(PlacePinError);
		expect(() => readPlacePinRemoval({ placeId: 'a/b' })).toThrow(PlacePinError);
	});
});
