// backend/services/aiPrediction.js
// Prédire le revenue pour les 3 prochains mois

function predictRevenue(historicalData) {
    if (!historicalData || historicalData.length < 3) {
        return {
            month1: 0,
            month2: 0,
            month3: 0,
            trend: 'stable'
        };
    }
    
    // Calculer la tendance
    const last3Months = historicalData.slice(-3);
    const avgGrowth = (last3Months[2] - last3Months[0]) / 2;
    
    const month1 = Math.max(0, last3Months[2] + avgGrowth);
    const month2 = Math.max(0, last3Months[2] + (avgGrowth * 2));
    const month3 = Math.max(0, last3Months[2] + (avgGrowth * 3));
    
    let trend = 'stable';
    if (avgGrowth > 500) trend = 'growing';
    if (avgGrowth < -500) trend = 'declining';
    
    return {
        month1: Math.round(month1),
        month2: Math.round(month2),
        month3: Math.round(month3),
        trend: trend,
        growthRate: ((month1 / last3Months[2]) * 100 - 100).toFixed(1)
    };
}

function calculateChurnRisk(clients) {
    const inactiveClients = clients.filter(c => c.status === 'inactive').length;
    const totalClients = clients.length;
    
    if (totalClients === 0) return 0;
    return (inactiveClients / totalClients) * 100;
}

module.exports = { predictRevenue, calculateChurnRisk };