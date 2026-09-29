module.exports = {
    validate: (submission) => {
        if (!submission || typeof submission !== 'string') {
            return { success: false, message: "Invalid payload type." };
        }

        const normalized = submission.trim();
        // Answer loaded from environment variable
        const EXPECTED = process.env.ERA3_ANSWER || "10.50.80.5";
        if (normalized === EXPECTED) {
            return { success: true };
        }

        return { success: false, message: "Incorrect IPv4 address sequence." };
    }
};