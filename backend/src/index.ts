import express from "express";
import http from "http";
import { Server } from "socket.io";
import { UserManager } from "./managers/userManager";
import { createMediasoupWorker } from "./utils/worker";
const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
const connections = io.of("/call");
const userManager = new UserManager();

connections.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("create-peer", (data) => {
    userManager.handlePeer(socket, data.displayName);
  });

  socket.emit("connection-success", {
    socketId: socket.id,
  });

  socket.on("disconnect", () => {
    userManager.removePeer(socket.id);
    console.log("A user disconnected");
  });
});

// run();

// async function run() {
createMediasoupWorker();
// }

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
