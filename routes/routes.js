const express = require("express");
const multer = require("multer");
const { VoiceOut, Feedback } = require("../models/model");
const WebSocket = require("ws");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const path = require("path");

// Ensure Cloudinary is configured
cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL,
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads", // Optional: name of the folder in Cloudinary
    format: async (req, file) => "jpg", // Supports 'png', 'jpg', etc.
    public_id: (req, file) => Date.now(), // Use current timestamp as the image ID
  },
});

// Multer middleware to handle image uploads
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = fileTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

const createRouter = (wss) => {
  if (!wss) {
    console.warn("WebSocket Server (wss) is not initialized in routes.js");
  }
  const router = express.Router();

  /* For Voice Outs Model */

  // Route to create a new voice_out with an image file
  router.post("/postVoiceOut", upload.single("photo"), async (req, res) => {
    const photoPath = req.file ? req.file.path : null;

    const voice_out = new VoiceOut({
      voice_out: req.body.voice_out,
      date: new Date(),
      photo: photoPath,
    });

    try {
      const savedVoice_out = await voice_out.save();

      // Broadcast new voice_out
      if (wss && wss.clients) {
        try {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({ type: "voice_out", data: savedVoice_out })
              );
            }
          });
        } catch (error) {
          console.error("Error during WebSocket broadcast:", error);
        }
      } else {
        console.warn("WebSocket Server is not initialized or has no clients");
      }

      res.status(200).json(savedVoice_out);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Route to fetch voice_outs with photo paths
  router.get("/getVoiceOuts", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
      const voice_outs = await VoiceOut.find({})
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit);
      res.json(voice_outs);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Route to delete a voice_out by ID
  router.delete("/deleteVoiceOut/:id", async (req, res) => {
    try {
      const voice_out = await VoiceOut.findByIdAndDelete(req.params.id);
      if (!voice_out)
        return res.status(404).json({ message: "Voice out not found" });

      res.json(voice_out);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /* For Feedback Model */

  router.post("/createFeedback", async (req, res) => {
    const { email, feedback, subject } = req.body;

    const newFeedback = new Feedback({
      email,
      feedback,
      subject,
      date: new Date(),
    });

    try {
      const savedFeedback = await newFeedback.save();
      res.status(201).json(savedFeedback);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  return router;
};

module.exports = createRouter;
