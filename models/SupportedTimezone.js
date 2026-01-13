import mongoose from "mongoose";

const SupportedTimezoneSchema = new mongoose.Schema({
    timezones: [{
        type: String,
    }]
}, {
    timestamps: true,
});

/**
 * Initialize with default timezones (idempotent)
 * @param {string[]} defaultTimezones - Array of IANA timezone strings
 */
SupportedTimezoneSchema.statics.initDefaults = async function (defaultTimezones) {
    const existing = await this.findOne();
    if (!existing) {
        await this.create({ timezones: defaultTimezones });
    }
};

/**
 * Add a timezone if not already in the array
 * @param {string} timezone - IANA timezone string
 * @returns {boolean} true if newly added, false if already existed
 */
SupportedTimezoneSchema.statics.addIfNew = async function (timezone) {
    if (!timezone) return false;

    const result = await this.updateOne(
        { timezones: { $ne: timezone } },
        { $addToSet: { timezones: timezone } }
    );

    if (result.modifiedCount > 0) {
        return true;
    }
    return false;
};

/**
 * Get all supported timezones as an array of strings
 */
SupportedTimezoneSchema.statics.getAllTimezones = async function () {
    const doc = await this.findOne().lean();
    return doc?.timezones || [];
};

const SupportedTimezone = mongoose.model("SupportedTimezone", SupportedTimezoneSchema);

export default SupportedTimezone;
