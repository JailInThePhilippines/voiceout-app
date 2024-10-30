const WebSocket = require("ws");

const initializeWebSocketServer = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("Client connected");
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
      } catch (error) {
        console.error("Failed to process message:", error);
      }
    });
    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });

  return wss;
};

module.exports = initializeWebSocketServer;
