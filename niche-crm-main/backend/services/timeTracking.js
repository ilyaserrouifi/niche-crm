// Time tracking service
let activeTimers = new Map();

function startTimer(userId) {
    activeTimers.set(userId, {
        startTime: Date.now(),
        isActive: true,
        totalTime: 0
    });
    return { success: true, message: 'Timer started' };
}

function stopTimer(userId) {
    const timer = activeTimers.get(userId);
    if (timer && timer.isActive) {
        const elapsed = (Date.now() - timer.startTime) / 1000;
        timer.totalTime += elapsed;
        timer.isActive = false;
        return { success: true, elapsedSeconds: elapsed };
    }
    return { success: false, message: 'No active timer' };
}

function getIdleTimer() {
    return { idleTime: 0, isIdle: false };
}

module.exports = { startTimer, stopTimer, getIdleTimer };
