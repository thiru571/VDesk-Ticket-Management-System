const Ticket = require('../models/Ticket.model');

/**
 * Calculates the system-wide average duration for each ticket status.
 * Focuses on 'assigned', 'in_progress', 'almost_complete', and 'closed'.
 */
const getSystemStatusAverages = async () => {
  try {
    // We only care about tickets that have completed these stages or are well into them.
    // To be accurate, we'll look at tickets that are resolved or closed.
    const tickets = await Ticket.find({ 
      status: { $in: ['resolved', 'closed'] },
      'statusHistory.0': { $exists: true } 
    }).select('statusHistory createdAt').lean();

    const totals = {
      assigned: 0,
      in_progress: 0,
      closed: 0, // This will be the total lead time (creation to closure)
    };
    const counts = {
      assigned: 0,
      in_progress: 0,
      closed: 0,
    };

    tickets.forEach(ticket => {
      const history = ticket.statusHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const durations = calculateTicketDurations(history, ticket.createdAt);

      if (durations.assigned > 0) {
        totals.assigned += durations.assigned;
        counts.assigned++;
      }
      if (durations.in_progress > 0) {
        totals.in_progress += durations.in_progress;
        counts.in_progress++;
      }
      // Lead time
      const closedEntry = history.find(h => h.to === 'closed' || h.to === 'resolved');
      if (closedEntry) {
        const leadTime = new Date(closedEntry.timestamp) - new Date(ticket.createdAt);
        totals.closed += leadTime;
        counts.closed++;
      }
    });

    return {
      assigned: counts.assigned > 0 ? totals.assigned / counts.assigned : 0,
      in_progress: counts.in_progress > 0 ? totals.in_progress / counts.in_progress : 0,
      closed: counts.closed > 0 ? totals.closed / counts.closed : 0,
    };
  } catch (err) {
    console.error('Error calculating status averages:', err);
    return { assigned: 0, in_progress: 0, closed: 0 };
  }
};

/**
 * Helper to calculate durations for a single ticket's history.
 * Returns durations in milliseconds.
 */
const calculateTicketDurations = (history, createdAt) => {
  const durations = {
    assigned: 0,
    in_progress: 0,
    closed: 0
  };

  if (!history || history.length === 0) return durations;

  // Track the entry time for each status
  let entryTimes = {};
  
  // The first status is usually 'open' at createdAt
  let currentStatus = 'open';
  let lastTimestamp = new Date(createdAt);

  history.forEach(event => {
    const eventTime = new Date(event.timestamp);
    const duration = eventTime - lastTimestamp;

    // Add duration to the status we are EXITING
    if (durations[currentStatus] !== undefined) {
      durations[currentStatus] += duration;
    } else if (currentStatus === 'open') {
        // We don't necessarily track 'open' in the return, but we could
    }

    currentStatus = event.to;
    lastTimestamp = eventTime;
  });

  // If the ticket is currently in a state, we don't add the "running" time here 
  // because this helper is used for finished durations or comparison.
  // But for the specific ticket display, we might want to include running time.

  return durations;
};

module.exports = {
  getSystemStatusAverages,
  calculateTicketDurations
};
