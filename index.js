require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const routes = require("./routes/routes");
const cors = require("cors");
const http = require("http");
const initializeWebSocketServer = require("./websocket/websocket");
const cloudinary = require("cloudinary").v2;

const app = express();
const server = http.createServer(app);
const wss = initializeWebSocketServer(server);
console.log("WebSocket Server initialized:", !!wss);

const mongoString = process.env.DATABASE_URL;
cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL,
});

mongoose.connect(mongoString);
const database = mongoose.connection;

database.on("error", (error) => console.log(error));
database.once("connected", () => console.log("Database Connected"));

app.use(express.json());
app.use(cors());
app.use("/api", routes(wss));
app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
