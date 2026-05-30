// backend/services/aiMatching.js
// Service AI pour recommander les meilleurs freelancers

const { pool } = require('../db');

async function matchFreelancers(project) {
    const { skill, budget, timeline } = project;
    
    try {
        // 1. Filter par compétence
        let freelancers = await pool.query(`
            SELECT * FROM users 
            WHERE role = 'freelancer' 
            AND status = 'active'
            AND (skills ILIKE $1 OR specialization ILIKE $1)
        `, [`%${skill}%`]);
        
        // 2. Trier par rating
        freelancers.rows.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        
        // 3. Retourner Top 3
        return freelancers.rows.slice(0, 3).map(f => ({
            id: f.id,
            name: f.full_name,
            skills: f.skills,
            rating: f.rating || 0,
            rate: f.salary || f.rate || 'Negotiable',
            score: calculateScoreFromRating(f.rating || 0)
        }));
    } catch (error) {
        console.error('AI Matching error:', error);
        return [];
    }
}

function calculateScoreFromRating(rating) {
    if (rating >= 4.5) return 'A';
    if (rating >= 3.5) return 'B';
    if (rating >= 2.5) return 'C';
    return 'D';
}

module.exports = { matchFreelancers };