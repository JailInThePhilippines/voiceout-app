const express = require("express");
const multer = require("multer");
const { VoiceOut, Feedback } = require("../models/model");
const path = require("path");
const fs = require("fs");
const WebSocket = require('ws');

// Multer configuration to handle file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
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

  // Serve static files from the uploads directory
  router.use("/uploads", express.static("uploads"));

  /* For Voice Outs Model */

  // Route to create a new voice_out with an image file
  router.post("/postVoiceOut", upload.single("photo"), async (req, res) => {
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

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
    try {
      const voice_outs = await VoiceOut.find({}).sort({ date: -1 });
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

      // Delete the associated file if it exists
      if (voice_out.photo) {
        fs.unlink(path.join(__dirname, "..", voice_out.photo), (err) => {
          if (err) console.error("Failed to delete file:", err);
        });
      }

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