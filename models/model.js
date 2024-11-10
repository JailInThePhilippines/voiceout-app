const mongoose = require('mongoose');

const voice_out_schema = new mongoose.Schema({
    voice_out: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    file: {
        type: String,
        required: false
    }
});

const feedback_schema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    feedback: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
        required: false,
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    }
});

const VoiceOut = mongoose.model('voice_outs_collection', voice_out_schema);
const Feedback = mongoose.model('feedbacks_collection', feedback_schema);

module.exports = { VoiceOut, Feedback };