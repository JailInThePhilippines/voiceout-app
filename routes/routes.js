const express = require("express");
const multer = require("multer");
const { VoiceOut, Feedback } = require("../models/model");
const path = require("path");
const fs = require("fs");
const WebSocket = require("ws");
const Grid = require("gridfs-stream");

// Multer configuration to handle file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = fileTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

const createRouter = (wss, gfs) => {
  if (!wss) {
    console.warn("WebSocket Server (wss) is not initialized in routes.js");
  }
  const router = express.Router();

  /* For Voice Outs Model */

  // Route to create a new voice_out with an image file
  router.post("/postVoiceOut", upload.single("photo"), async (req, res) => {
    if (!gfs)
      return res.status(500).json({ message: "GridFS not initialized" });

    const writeStream = gfs.createWriteStream({
      filename: req.file.originalname,
      content_type: req.file.mimetype,
      metadata: { voice_out: req.body.voice_out },
    });

    writeStream.write(req.file.buffer);
    writeStream.end();

    writeStream.on("finish", async (file) => {
      const voice_out = new VoiceOut({
        voice_out: req.body.voice_out,
        date: new Date(),
        photo: file._id,
      });

      try {
        const savedVoice_out = await voice_out.save();

        // Broadcast new voice_out
        if (wss && wss.clients) {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({ type: "voice_out", data: savedVoice_out })
              );
            }
          });
        }

        res.status(200).json(savedVoice_out);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    writeStream.on("error", (error) => {
      res.status(500).json({ message: "File upload failed", error });
    });
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
      if (!voice_out) return res.status(404).json({ message: "Voice out not found" });

      // Remove the file from GridFS
      if (voice_out.photo) {
        gfs.remove({ _id: voice_out.photo, root: 'uploads' }, (err) => {
          if (err) return res.status(500).json({ message: "Failed to delete file", error: err });
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
