module.exports = {
    validate: (submission) => {
        if (!submission || typeof submission !== 'string') {
            return { success: false, message: "Invalid payload type." };
        }

        const normalized = submission.trim();
        // Target string from the decoded punch card ASCII binary format
        // Answer loaded from environment variable to prevent source-code leakage
        const EXPECTED = process.env.ERA1_ANSWER || "D:\\Nothing\\.git\\config";
        if (normalized === EXPECTED) {
            return { success: true };
        }

        return { success: false, message: "Incorrect path configuration string." };
    }
};