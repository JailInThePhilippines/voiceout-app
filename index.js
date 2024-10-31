require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const routes = require('./routes/routes');
const cors = require('cors');
const http = require('http');
const initializeWebSocketServer = require('./websocket/websocket');
const Grid = require('gridfs-stream');

const app = express();
const server = http.createServer(app);
const wss = initializeWebSocketServer(server);

const mongoString = process.env.DATABASE_URL;

// Initialize MongoDB connection and GridFS
mongoose.connect(mongoString, { useNewUrlParser: true, useUnifiedTopology: true });
const database = mongoose.connection;
let gfs;

database.once('open', () => {
  gfs = Grid(database.db, mongoose.mongo);
  gfs.collection('uploads'); // Set collection for GridFS
  console.log('Database and GridFS connected');
});

database.on('error', (error) => console.log(error));

// Middleware and routes
app.use(express.json());
app.use(cors());

// Ensure GridFS is initialized before using it in routes
app.use((req, res, next) => {
  if (!gfs) {
    return res.status(500).json({ message: "GridFS not initialized" });
  }
  req.gfs = gfs;
  next();
});

// Use routes and pass wss and gfs
app.use('/api', routes(wss, gfs));
app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));