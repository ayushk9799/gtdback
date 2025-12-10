/**
 * Agenda Job Scheduler for Notifications
 * 
 * Uses MongoDB-backed Agenda for persistent job scheduling.
 * Jobs survive server restarts.
 */

import { Agenda } from 'agenda';
import { sendPersonalizedNotifications } from '../utils/personalizedNotifications.js';

let agenda = null;

/**
 * Initialize and start Agenda with the given MongoDB URI
 */
export async function startScheduler(mongoUri) {
    agenda = new Agenda({
        db: { address: mongoUri, collection: 'agendaJobs' },
        processEvery: '1 minute'
    });

    // Define the job
    agenda.define('send daily case notifications', async (job) => {
        console.log('Running scheduled job: send daily case notifications');
        try {
            const stats = await sendPersonalizedNotifications();
            console.log('Job stats:', stats);
        } catch (error) {
            console.error('Job error:', error);
        }
    });

    // Start agenda
    await agenda.start();
    console.log('Agenda scheduler started');

    // Schedule daily at 9:00 AM IST (which is 3:30 AM UTC)
    // Cron: minute hour day month dayOfWeek
    await agenda.every('0 3 * * *', 'send daily case notifications', {}, { timezone: 'Asia/Kolkata' });
    console.log('Scheduled: send daily case notifications at 9:00 AM IST');

    return agenda;
}

/**
 * Graceful shutdown
 */
export async function stopScheduler() {
    if (agenda) {
        await agenda.stop();
        console.log('Agenda scheduler stopped');
    }
}

/**
 * Manually trigger the job (for testing)
 */
export async function triggerNow() {
    if (!agenda) {
        throw new Error('Agenda not initialized');
    }
    await agenda.now('send daily case notifications');
    return { message: 'Job triggered' };
}

export default { startScheduler, stopScheduler, triggerNow };
