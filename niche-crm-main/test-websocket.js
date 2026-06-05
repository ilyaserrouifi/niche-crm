const io = require('socket.io-client');
const socket = io('https://niche-crm-iota.vercel.app');

socket.on('connect', () => {
    console.log('✅ WebSocket connected!');
    socket.emit('join-project', 1);
    socket.emit('task-update', { projectId: 1, task: 'Test task' });
    setTimeout(() => process.exit(0), 2000);
});

socket.on('connect_error', (err) => {
    console.log('❌ WebSocket error:', err.message);
    process.exit(1);
});
