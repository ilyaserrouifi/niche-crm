const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Simulation d'une base de données (pour le test)
const users = [
    {
        id: 1,
        email: 'admin@niche.com',
        password: 'admin123',
        full_name: 'Admin User',
        role: 'admin'
    }
];

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '..')));

// --- Routes API de test ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// --- ROUTE LOGIN ---
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    if (user.password !== password) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Générer un faux token
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    res.json({
        success: true,
        token: token,
        role: user.role,
        name: user.full_name,
        id: user.id,
        email: user.email
    });
});

// --- ROUTE REGISTER ---
app.post('/api/auth/register', (req, res) => {
    const { full_name, email, username, phone, role, password_hash } = req.body;
    
    // Vérifier si l'utilisateur existe
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    
    // Créer le nouvel utilisateur
    const newUser = {
        id: users.length + 1,
        email: email,
        password: password_hash,
        full_name: full_name,
        role: role || 'client'
    };
    
    users.push(newUser);
    
    res.json({ success: true, user: newUser });
});

// --- Pour que Vercel sache quoi exporter ---
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

// ⭐ CE MODULE.EXPORTS EST CRUCIAL POUR VERCEL
module.exports = app;