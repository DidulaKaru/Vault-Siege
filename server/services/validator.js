const crypto = require('crypto');

function timingSafeStringEqual(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') {
        return false;
    }

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
            if (submission.length > 500) {
                return false;
            }
            try {
                const pattern = (target.startsWith('^') && target.endsWith('$'))
                    ? target
                    : `^(?:${target})$`;
                return new RegExp(pattern, 'i').test(submission);
            } catch (error) {
                return false;
            }
        case 'HASH_SHA256': {
            try {
                const actualHash = crypto.createHash('sha256').update(submission.trim(), 'utf8').digest();
                if (!/^[a-f0-9]{64}$/i.test(target)) return false;
                const expectedHash = Buffer.from(target, 'hex');

                return expectedHash.length === actualHash.length
                    && crypto.timingSafeEqual(actualHash, expectedHash);
            } catch (error) {
                return false;
            }
        }
        default:
            return false;
    }
}

module.exports = { validateSubmission, timingSafeStringEqual };
