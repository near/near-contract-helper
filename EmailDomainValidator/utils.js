function isEntryStale(entry) {
    return entry.staleAt.valueOf() < Date.now().valueOf();
}

// We want to occasionally re-check the state of a domain
// So we catch changes to a domain's status after we have verified it
function getStaleDate(date) {
    let _14DaysInMs = 1000 * 60 * 60 * 24 * 14;
    return new Date(date.valueOf() + _14DaysInMs);
}

module.exports = {
    isEntryStale,
    getStaleDate
};