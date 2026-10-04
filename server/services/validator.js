const crypto = require('crypto');

function timingSafeStringEqual(left, right) {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    return leftBuffer.length === rightBuffer.length
        && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function validateSubmission(submission, validatorType, target) {
    if (typeof submission !== 'string' || typeof target !== 'string') {
        return false;
    }

    switch (validatorType) {
        case 'EXACT_MATCH':
            return timingSafeStringEqual(submission, target);
        case 'CASE_INSENSITIVE':
            return timingSafeStringEqual(submission.trim().toLowerCase(), target.trim().toLowerCase());
        case 'REGEX':
            try {
                return new RegExp(target).test(submission);
            } catch (error) {
                return false;
            }
        case 'HASH_SHA256': {
            const actualHash = crypto.createHash('sha256').update(submission.trim(), 'utf8').digest();
            if (!/^[a-f0-9]{64}$/i.test(target)) return false;
            const expectedHash = Buffer.from(target, 'hex');

            return expectedHash.length === actualHash.length
                && crypto.timingSafeEqual(actualHash, expectedHash);
        }
        default:
            return false;
    }
}

module.exports = { validateSubmission };