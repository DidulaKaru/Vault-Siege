const era1Punchcards = require('./era1-punchcards');
const era2Hash = require('./era2-hash');
const era3Book = require('./era3-book');
const era4Morse = require('./era4-morse');
const era5Github = require('./era5-github');

const puzzles = {
    "punchcards": era1Punchcards,
    "hash": era2Hash,
    "book": era3Book,
    "morse": era4Morse,
    "github": era5Github
    // "siege" removed — Era 6 progression is handled exclusively by
    // the connection-count interval in index.js. No bypass-layer shortcut.
};

function findPuzzle(layerId) {
    const puzzle = puzzles[layerId];
    if (!puzzle) {
        throw new Error(`No validation module found for layer: ${layerId}`);
    }
    return puzzle;
}

module.exports = { findPuzzle };