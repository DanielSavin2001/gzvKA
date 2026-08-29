module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // `tsc` emits the compiled tests into lib/, where jest's default testMatch picks them
    // up as a second copy of every suite. That doubles the reported test count and, worse,
    // lets a stale build keep reporting green after the TypeScript source has broken.
    testPathIgnorePatterns: ['/node_modules/', '/lib/'],
};