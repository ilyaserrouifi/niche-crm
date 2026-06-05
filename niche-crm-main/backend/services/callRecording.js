// Twilio call recording service
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function startCallRecording(to, from) {
    try {
        const call = await client.calls.create({
            url: 'http://demo.twilio.com/docs/voice.xml',
            to: to,
            from: from,
            record: true
        });
        return { success: true, callSid: call.sid };
    } catch (error) {
        console.error('Call recording error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { startCallRecording };