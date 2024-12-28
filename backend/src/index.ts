import express from "express";
import http from "http";
import { Server } from "socket.io";
import { UserManager } from "./managers/userManager";
import { createMediasoupWorker } from "./utils/worker";
import { WebRtcTransport } from "mediasoup/node/lib/WebRtcTransportTypes";
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
  socket.emit("connection-success", {
    socketId: socket.id,
  });

  socket.on("create-peer", (data, callback) => {
    userManager.handleNewPeer(
      socket,
      data.displayName || "Anonymous",
      data.roomId
    );
    callback();
  });

  socket.on("join-room", async (data, callback) => {
    await userManager.addPeerToRoom(socket.id, data.roomId);
    callback({
      rtpCapabilities: userManager.getRouter(data.roomId)?.rtpCapabilities,
    });
  });

  socket.on("create-transport", async (data, callback) => {
    userManager
      .createTransport(socket.id, data.roomId, data.consumer)
      .then((transport: any) => {
        console.log("Transport ->", transport.id);
        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });

        //Add transport for producing
      })
      .catch((error) => {
        console.error("Error creating transport", error);
        callback({ params: { error: error } });
      });
  });

  socket.on("connect-transport", async (data) => {
    console.log("DTLS Parameters", data.dtlsParameters);

    await userManager.connectTransport(
      socket.id,
      data.dtlsParameters,
      data.consumer
    );
  });

  socket.on("produce-transport", async (data, callback) => {
    // console.log("Produce transport", data);

    const producer = await userManager.produceTransport(socket.id, data);

    userManager.addProducerToRoom(socket.id, data.roomId, producer!, data.kind);

    console.log("Need to inform consumers");

    userManager.informAllConsumers(data.roomId, producer!.id, socket.id);

    callback({
      id: producer?.id,
      producersExist:
        userManager.getOtherProducersLength(socket.id, data.roomId)! > 0,
    });
  });

  socket.on("consume-transport", async (data, callback) => {
    try {
      const params = await userManager.consumeTransport(
        data.roomId,
        data.remoteProducerId,
        data.rtpCapabilities,
        socket
      );
      callback({ params });
    } catch (error) {
      console.log("Error consuming transport", error);
      callback({ error });
    }
  });

  socket.on("resume-consumer", async ({ roomId, serverConsumerId }) => {
    await userManager.resumeConsumer(roomId, serverConsumerId);
  });

  socket.on("get-producers", (data, callback) => {
    const producers = userManager.getOtherProducers(data.roomId, socket.id);
    callback(producers);
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
