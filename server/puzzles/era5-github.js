module.exports = {
    validate: (submission) => {
        // Rate limit threshold loaded from environment variable
        const threshold = parseInt(process.env.ERA5_RATE_LIMIT) || 200;

        if (submission && submission.attackModeEnabled === true && submission.maxRateLimit >= threshold) {
            return { success: true };
        }

        return {
            success: false,
            message: "Pull Request rejected: core system still bound by rate-limiting middleware maximum = 1."
        };
    }
};