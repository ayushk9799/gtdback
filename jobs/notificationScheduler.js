/**
 * Agenda Job Scheduler for Timezone-Aware Notifications
 * 
 * Uses MongoDB-backed Agenda for persistent job scheduling.
 * Sends notifications at 12:00 AM (midnight) and 8:00 AM local time for each user.
 */

import { Agenda } from 'agenda';
import { sendPersonalizedNotifications } from '../utils/personalizedNotifications.js';
import SupportedTimezone from '../models/SupportedTimezone.js';

let agenda = null;

// Default IANA timezones - used for initial seeding
// New timezones are automatically added when users register with them
export const DEFAULT_TIMEZONES = [
    'Pacific/Honolulu',      // UTC-10
    'America/Anchorage',     // UTC-9
    'America/Los_Angeles',   // UTC-8 (PST)
    'America/Denver',        // UTC-7 (MST)
    'America/Chicago',       // UTC-6 (CST)
    'America/New_York',      // UTC-5 (EST)
    'America/Detroit',       // UTC-5 (EST)
    'America/Sao_Paulo',     // UTC-3
    'Europe/London',         // UTC+0/+1
    'Europe/Paris',          // UTC+1/+2
    'Europe/Bucharest',      // UTC+2/+3
    'Europe/Budapest',       // UTC+1/+2
    'Europe/Moscow',         // UTC+3
    'Asia/Jerusalem',        // UTC+2/+3
    'Asia/Baghdad',          // UTC+3
    'Asia/Dubai',            // UTC+4
    'Asia/Tehran',           // UTC+3:30
    'Asia/Karachi',          // UTC+5
    'Asia/Kolkata',          // UTC+5:30 (IST)
    'Asia/Calcutta',         // UTC+5:30 (IST alias)
    'Asia/Dhaka',            // UTC+6
    'Asia/Bangkok',          // UTC+7
    'Asia/Singapore',        // UTC+8
    'Asia/Tokyo',            // UTC+9
    'Asia/Qatar',            // UTC+3
    'Australia/Brisbane',    // UTC+10
    'Australia/Sydney',      // UTC+10/+11
    'Pacific/Auckland',      // UTC+12/+13
];

// Target notification hours (in local time)
const TARGET_HOURS = [0, 8]; // 12:00 AM (midnight) and 8:00 AM

/**
 * Get list of timezones where current time matches any target hour
 * Queries database for supported timezones
 * @returns {Promise<string[]>} Array of timezone strings where it's currently a target hour
 */
async function getTimezonesAtTargetHours() {
    const now = new Date();
    const matchingTimezones = [];

    // Get timezones from database
    const supportedTimezones = await SupportedTimezone.getAllTimezones();

    for (const tz of supportedTimezones) {
        try {
            // Get current hour in this timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: 'numeric',
                hour12: false
            });
            const hourStr = formatter.format(now);
            const currentHour = parseInt(hourStr, 10);

            // Check if this timezone is at any target hour
            if (TARGET_HOURS.includes(currentHour)) {
                matchingTimezones.push(tz);
            }
        } catch (error) {
            console.error(`Error checking timezone ${tz}:`, error.message);
        }
    }

    return matchingTimezones;
}

/**
 * Initialize and start Agenda with the given MongoDB URI
 */
export async function startScheduler(mongoUri) {
    // Initialize default timezones in database
    await SupportedTimezone.initDefaults(DEFAULT_TIMEZONES);

    agenda = new Agenda({
        db: { address: mongoUri, collection: 'agendaJobs' },
        processEvery: '1 minute'
    });

    // Define the timezone-aware notification job
    agenda.define('send timezone notifications', async (job) => {
        try {
            const targetTimezones = await getTimezonesAtTargetHours();

            if (targetTimezones.length === 0) {
                return;
            }


            const stats = await sendPersonalizedNotifications(targetTimezones);
        } catch (error) {
            console.error('[Notification Job] Error:', error);
        }
    });

    // Start agenda
    await agenda.start();

    // Remove old job if exists
    await agenda.cancel({ name: 'send daily case notifications' });

    // Schedule to run every hour at minute 0
    // This checks all timezones and sends to those at 12 AM or 8 AM local time
    await agenda.every('0 * * * *', 'send timezone notifications');


    return agenda;
}

/**
 * Graceful shutdown
 */
export async function stopScheduler() {
    if (agenda) {
        await agenda.stop();
    }
}

/**
 * Manually trigger the job (for testing)
 */
export async function triggerNow() {
    if (!agenda) {
        throw new Error('Agenda not initialized');
    }
    await agenda.now('send timezone notifications');
    return { message: 'Timezone notification job triggered' };
}

/**
 * Get current status - useful for debugging
 */
export function getTimezonesAtTargetHoursNow() {
    return getTimezonesAtTargetHours();
}

export default { startScheduler, stopScheduler, triggerNow, getTimezonesAtTargetHoursNow };
