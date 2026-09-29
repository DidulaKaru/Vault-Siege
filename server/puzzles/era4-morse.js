module.exports = {
    validate: (submission) => {
        if (!submission || typeof submission !== 'string') {
            return { success: false, message: "Invalid payload type." };
        }

        const normalized = submission.trim().toUpperCase();
        // Answer loaded from environment variable
        const EXPECTED = (process.env.ERA4_ANSWER || "NCC").toUpperCase();
        if (normalized === EXPECTED) {
            return { success: true };
        }

        return { success: false, message: "Invalid destination building code." };
    }
};