const express = require("express");
const multer = require("multer");
const { VoiceOut, Feedback } = require("../models/model");
const WebSocket = require("ws");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const path = require("path");

// Configured Cloudinary
cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL,
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads",
    public_id: (req, file) => Date.now(),
  },
});

// Multer middleware to handle uploads
const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      let resourceType = "image"; // Default to 'image'
      const audioVideoTypes = /mp3|mp4|m4a|wav|avi|mkv|mov/;

      if (audioVideoTypes.test(path.extname(file.originalname).toLowerCase())) {
        resourceType = "video"; // Set 'video' for audio or video files
      }

      console.log("Uploading file with resource_type:", resourceType);
      return {
        folder: "uploads",
        resource_type: resourceType,
        public_id: Date.now().toString(),
      };
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|gif|mp3|mp4|m4a|wav|avi|mkv|mov|pdf|docx|txt/;
    const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());

    const audioVideoTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "video/mp4",
      "video/avi",
      "video/mkv",
      "video/quicktime",
    ];
    const isMimeTypeAllowed = allowedFileTypes.test(file.mimetype) || audioVideoTypes.includes(file.mimetype);

    if (extname && isMimeTypeAllowed) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

const createRouter = (wss) => {
  if (!wss) {
    console.warn("WebSocket Server (wss) is not initialized in routes.js");
  }
  
  const router = express.Router();

  /* For Voice Outs Model */

  // Route to create a new voice_out with a file attachment
  router.post("/postVoiceOut", upload.single("file"), async (req, res) => {
    console.log("Uploaded file:", req.file);
    const filePath = req.file ? req.file.path : null;

    const voice_out = new VoiceOut({
      voice_out: req.body.voice_out,
      date: new Date(),
      file: filePath,
    });

    try {
      const savedVoiceOut = await voice_out.save();

      // Broadcast new voice_out with file URL
      if (wss && wss.clients) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({ type: "voice_out", data: savedVoiceOut })
            );
          }
        });
      } else {
        console.warn("WebSocket Server is not initialized or has no clients");
      }

      res.status(200).json(savedVoiceOut);
    } catch (error) {
      console.error("Error saving voice out:", error);
      res.status(500).json({ message: error.message });
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
