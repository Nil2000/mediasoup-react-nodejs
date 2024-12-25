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
  socket.emit("connection-success", {
    socketId: socket.id,
  });

  socket.on("create-peer", (data, callback) => {
    userManager.handleNewPeer(socket, data.displayName || "Anonymous");
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
      .createTransport(socket.id, data.roomId)
      .then((transport: any) => {
        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });
        console.log("Transport created", transport.id);

        //Add transport for producing
        userManager.addTransportToRoom(
          socket.id,
          data.roomId,
          transport,
          data.consumer
        );
      })
      .catch((error) => {
        console.error("Error creating transport", error);
        callback({ error: error });
      });
  });

  socket.on("connect-transport", async (data) => {
    console.log("DTLS Parameters", data.dtlsParameters);

    if (!data.consumer) {
      await userManager.connectTransportToRoom(
        socket.id,
        data.roomId,
        data.dtlsParameters,
        data.consumer
      );
    } else {
      await userManager.connectReceiverTransportToRoom(
        data.remoteProducerId,
        data.roomId,
        data.dtlsParameters,
        data.consumer
      );
    }
  });

  socket.on("produce-transport", async (data, callback) => {
    console.log("Produce transport", data);

    const producer = await userManager.produceTransportOfRooom(socket.id, data);

    userManager.addProducerToRoom(socket.id, data.roomId, producer!);

    //TODO: inform consumers
    console.log("Need to inform consumers");

    producer?.on("transportclose", () => {
      console.log("Producer transport closed");
      producer.close();
    });

    callback({
      id: producer?.id,
      producersExist:
        userManager.getOtherProducersLength(socket.id, data.roomId)! > 0,
    });
  });

  socket.on("get-producers", (data, callback) => {
    const producers = userManager.getOtherProducers(data.roomId, socket.id);
    callback(producers);
  });

  socket.on("connect-reciever-transport", async (data, callback) => {});

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
