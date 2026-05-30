const Pusher = require('pusher');
require('dotenv').config();

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
});

pusher.trigger('niche-crm-channel', 'test-event', { 
    message: 'Niche CRM is working!', 
    timestamp: new Date().toISOString() 
});

console.log('✅ Pusher event sent to channel: niche-crm-channel');
console.log('📡 Real-time WebSocket is ready!');
