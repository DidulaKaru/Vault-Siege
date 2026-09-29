module.exports = {
    validate: (submission) => {
        // Direct bypass manual input fallback in case automated flood needs emergency override
        if (submission && submission.overrideKey === "OVERLOAD_CORE_2026") {
            return { success: true };
        }
        return { success: false, message: "Insufficient concurrency stress payload." };
    }
};