// backend/services/aiScoring.js
// Calcul automatique du score A/B/C/D pour freelancers

function calculateScore(freelancer) {
    const kpis = {
        callsMade: freelancer.todayCalls || 0,
        meetingsBooked: freelancer.meetingsBooked || 0,
        replyRate: freelancer.replyRate || 0,
        rating: freelancer.rating || 0
    };
    
    const targetCalls = 50;
    const targetMeetings = 2;
    const targetReply = 10;
    const targetRating = 5;
    
    const callScore = Math.min(100, (kpis.callsMade / targetCalls) * 100);
    const meetingScore = Math.min(100, (kpis.meetingsBooked / targetMeetings) * 100);
    const replyScore = Math.min(100, (kpis.replyRate / targetReply) * 100);
    const ratingScore = (kpis.rating / targetRating) * 100;
    
    const avgScore = (callScore + meetingScore + replyScore + ratingScore) / 4;
    
    if (avgScore >= 90) return 'A';
    if (avgScore >= 70) return 'B';
    if (avgScore >= 50) return 'C';
    return 'D';
}

function getScoreColor(score) {
    const colors = {
        'A': '#10b981',
        'B': '#60a5fa',
        'C': '#f59e0b',
        'D': '#ef4444'
    };
    return colors[score] || '#6b7280';
}

module.exports = { calculateScore, getScoreColor };