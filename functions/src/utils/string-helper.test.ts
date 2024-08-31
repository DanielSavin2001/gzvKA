import {isNullOrEmpty, extractDatesFromText, getFileExtension, removeFileExtension} from './string-helper'; // Adjust the import path as needed


describe('isNullOrEmpty', () => {

    /**
     * Test case for when the input string is null.
     */
    it('should return true if the input is null', () => {
        expect(isNullOrEmpty(null)).toBe(true);
    });

    /**
     * Test case for when the input string is undefined.
     */
    it('should return true if the input is undefined', () => {
        expect(isNullOrEmpty(undefined)).toBe(true);
    });

    /**
     * Test case for when the input string is an empty string.
     */
    it('should return true if the input is an empty string', () => {
        expect(isNullOrEmpty('')).toBe(true);
    });

    /**
     * Test case for when the input string contains only whitespace.
     */
    it('should return true if the input is a string with only whitespace', () => {
        expect(isNullOrEmpty('   ')).toBe(true);
    });

    /**
     * Test case for when the input string contains non-whitespace characters.
     */
    it('should return false if the input is a non-empty string', () => {
        expect(isNullOrEmpty('Hello')).toBe(false);
    });

    /**
     * Test case for when the input string contains non-whitespace characters but with leading/trailing whitespace.
     */
    it('should return false if the input is a non-empty string with leading/trailing whitespace', () => {
        expect(isNullOrEmpty('  Hello  ')).toBe(false);
    });
});

describe('extractDatesFromText', () => {
    test('should return empty strings if no dates are present', () => {
        const result = extractDatesFromText('No dates here');
        expect(result).toEqual({dateOfAcquisition: '', yearOfImage: ''});
    });

    test('should return empty strings if there are 3 dates', () => {
        const result = extractDatesFromText('Here are 3 dates: 2000, 1999, 1859');
        expect(result).toEqual({dateOfAcquisition: '', yearOfImage: ''});
    });

    test('should return empty strings if there are more than 3 dates', () => {
        const result = extractDatesFromText('Here are 3 dates: 2000, 1999, 1859, 1900, 2049');
        expect(result).toEqual({dateOfAcquisition: '', yearOfImage: ''});
    });

    test('should return the correct year if only one date is present and it is >= 2014', () => {
        const result = extractDatesFromText('The year is 2020');
        expect(result).toEqual({dateOfAcquisition: '2020', yearOfImage: '2020'});
    });

    test('should return the correct year if only one date is present and it is < 2014', () => {
        const result = extractDatesFromText('The year is 2010');
        expect(result).toEqual({dateOfAcquisition: '', yearOfImage: '2010'});
    });

    test('should return two dates when two are present', () => {
        const result = extractDatesFromText('Years are 1999 and 2021');
        expect(result).toEqual({dateOfAcquisition: '2021', yearOfImage: '1999'});
    });

    test('should handle the edge case where date is 1800', () => {
        const result = extractDatesFromText('Year is 1800');
        expect(result).toEqual({dateOfAcquisition: '', yearOfImage: '1800'});
    });

    test('should handle the edge case where date is 3000', () => {
        const result = extractDatesFromText('Year is 3000');
        expect(result).toEqual({dateOfAcquisition: '3000', yearOfImage: '3000'});
    });

    test('should handle multiple dates with one being in a special case', () => {
        const result = extractDatesFromText('Years are 2021 and 1900');
        expect(result).toEqual({dateOfAcquisition: '2021', yearOfImage: '1900'});
    });

    test('#1 Realistic example', () => {
        const result = extractDatesFromText('Heemkring Hoghescote - 21.09.2017.jpg');
        expect(result).toEqual({dateOfAcquisition: '2017', yearOfImage: '2017'});
    });

    test('#2 Realistic example', () => {
        const result = extractDatesFromText('mobilisatie 1939 - Heemkring Hoghescote - 21.09.2017.jpg');
        expect(result).toEqual({dateOfAcquisition: '2017', yearOfImage: '1939'});
    });

    test('#3 Realistic example', () => {
        const result = extractDatesFromText('Jan Ketelaars 6 - Hoghescote - 1988.jpg');
        expect(result).toEqual({dateOfAcquisition: '', yearOfImage: '1988'});
    });

    test('#4 Realistic example', () => {
        const result = extractDatesFromText('Louwke Poep 1925_2 - Swatti Alix - z.d.');
        expect(result).toEqual({dateOfAcquisition: '', yearOfImage: '1925'});
    });
});

describe('getFileExtension', () => {
    it('should return the correct file extension with a leading dot', () => {
        expect(getFileExtension('OWNP - Huis ten Halven_1 1933 - Johan Van Elst - 21.11.2014.jpg')).toBe('.jpg');
        expect(getFileExtension('Bloemenlei - mobilisatie 1939.png')).toBe('.png');
        expect(getFileExtension('document.pdf')).toBe('.pdf');
        expect(getFileExtension('archive.tar.gz')).toBe('.gz');
        expect(getFileExtension('no_extension')).toBe('');
    });

    it('should return an empty string if no extension is present', () => {
        expect(getFileExtension('filenamewithoutextension')).toBe('');
        expect(getFileExtension('anotherfilename.')).toBe('');
    });
});

describe('removeFileExtension', () => {
    it('should return the filename without the extension', () => {
        expect(removeFileExtension('OWNP - Huis ten Halven_1 1933 - Johan Van Elst - 21.11.2014.jpg')).toBe('OWNP - Huis ten Halven_1 1933 - Johan Van Elst - 21.11.2014');
        expect(removeFileExtension('Bloemenlei - mobilisatie 1939.png')).toBe('Bloemenlei - mobilisatie 1939');
        expect(removeFileExtension('document.pdf')).toBe('document');
        expect(removeFileExtension('archive.tar.gz')).toBe('archive.tar');
        expect(removeFileExtension('no_extension')).toBe('no_extension');
    });

    it('should return the original filename if no extension is present', () => {
        expect(removeFileExtension('filenamewithoutextension')).toBe('filenamewithoutextension');
        expect(removeFileExtension('anotherfilename.')).toBe('anotherfilename.');
    });
});