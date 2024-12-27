import { Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import { Producer, Transport, WebRtcTransport } from "mediasoup/node/lib/types";

export interface Peer {
  socket: Socket;
  displayName?: string;
  transports: {
    transport: WebRtcTransport;
    consumer: boolean;
  }[];
  // producers: Map<string, any>;
  // consumers: Map<string, any>;
}

const transport_options = {
  listenIps: [
    {
      ip: "0.0.0.0",
      announcedIp: "172.23.119.11",
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
};

export class UserManager {
  private peers: Map<string, Peer>;
  private roomManager: RoomManager;
  private transportCreationLocks = new Map<string, Promise<any>>();

  constructor() {
    this.peers = new Map();
    this.roomManager = new RoomManager();
    console.log("User Manager initialized");
  }

  handleNewPeer(socket: Socket, displayName: string) {
    const newPeer: Peer = {
      socket,
      displayName,
      transports: [],
      // producers: new Map(),
      // consumers: new Map(),
    };
    this.peers.set(socket.id, newPeer);
    console.log("New peer connected");
  }

  removePeer(socketId: string) {
    //Close all transports, producers and consumers
    if (this.peers.has(socketId)) {
      this.peers.delete(socketId);
      console.log("Peer removed");
    }
  }

  async addPeerToRoom(socketId: string, roomId: string) {
    if (!this.peers.has(socketId)) {
      console.error("Peer not found");
      return;
    }
    await this.roomManager.addPeerToRoom(roomId, this.peers.get(socketId)!);
    console.log("Peer added to room");
  }

  getRouter(roomId: string) {
    return this.roomManager.getRouter(roomId);
  }

  async createTransport(socketId: string, roomId: string, consumer: boolean) {
    console.log("UserManager Create transport", socketId, roomId, consumer);

    if (!this.peers.has(socketId)) {
      console.error("Peer not found");
      return;
    }

    const peer = this.peers.get(socketId);

    const router = this.getRouter(roomId);

    if (!router) {
      console.error("Router not found");
      return;
    }

    let transport = peer?.transports.find(
      (t) => t.consumer === consumer
    )?.transport;

    if (transport) {
      console.log("Transport found->", transport);
      return transport;
    }

    //Create locks for transport creation
    const lockKey = `${socketId}-${consumer}`;
    const existingCreationPromise = this.transportCreationLocks.get(lockKey);
    if (existingCreationPromise) {
      return existingCreationPromise;
    }

    const creationPromise = (async () => {
      try {
        const newTransport = await router.createWebRtcTransport(
          transport_options
        );

        newTransport.on("dtlsstatechange", (dtlsState) => {
          if (dtlsState === "closed") {
            newTransport.close();
            console.log("Transport closed");
          }
        });

        newTransport.on("@close", () => {
          console.log("Transport closed", newTransport.id);
        });

        peer?.transports.push({
          transport: newTransport,
          consumer: consumer,
        });

        console.log("Transport created->", newTransport.id);
        return newTransport;
      } finally {
        this.transportCreationLocks.delete(lockKey);
      }
    })();

    this.transportCreationLocks.set(lockKey, creationPromise);

    return creationPromise;
  }

  // addTransportToRoom(
  //   socketId: string,
  //   roomId: string,
  //   transport: WebRtcTransport,
  //   consumer: boolean
  // ) {
  //   this.roomManager.addTransport(socketId, roomId, transport, consumer);
  // }

  // async connectTransportToRoom(
  //   socketId: string,
  //   roomId: string,
  //   dtlsParameters: any,
  //   consumer: boolean
  // ) {
  //   await this.roomManager.connectTransport(
  //     socketId,
  //     roomId,
  //     dtlsParameters,
  //     consumer
  //   );
  // }

  async connectTransport(
    socketId: string,
    dtlsParameters: any,
    consumer: boolean
  ) {
    if (!this.peers.has(socketId)) {
      console.error("Peer not found");
      return;
    }

    const peer = this.peers.get(socketId);

    let transport = peer?.transports.find(
      (t) => t.consumer === consumer
    )?.transport;

    if (!transport) {
      console.log("Transport not found");
      return;
    }

    await transport.connect({ dtlsParameters });

    console.log("Transport connected->", transport.id);
  }

  async produceTransport(socketId: string, data: any) {
    console.log("UserManager Produce transport");
    const peer = this.peers.get(socketId);

    if (!peer) {
      console.error("Peer not found");
      return;
    }

    const transport = peer.transports.find((t) => !t.consumer)?.transport;

    if (!transport) {
      console.error("Producer Transport not found");
      return;
    }

    const producer = await transport.produce({
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    producer.on("transportclose", () => {
      console.log("Producer transport closed");
      producer.close();
    });

    return producer;
  }

  addProducerToRoom(
    socketId: string,
    roomId: string,
    producer: Producer,
    kind: string
  ) {
    this.roomManager.addProducer(socketId, roomId, producer, kind);
  }

  getOtherProducersLength(socketId: string, roomId: string) {
    return this.roomManager.getOtherProducerLength(socketId, roomId);
  }

  getOtherProducers(roomId: string, socketId: string) {
    return this.roomManager.getOtherProducers(roomId, socketId);
  }
  async connectReceiverTransportToRoom(
    socketId: string,
    roomId: string,
    dtlsParameters: any,
    consumer: boolean
  ) {
    await this.roomManager.connectRecieverTransport(
      socketId,
      roomId,
      dtlsParameters,
      consumer
    );
  }

  async consumeTransport(
    roomId: string,
    producerId: string,
    rtpCapabilities: any,
    socket: Socket
  ) {
    const producer = this.roomManager.getProducer(roomId, producerId);

    if (!producer) {
      console.error("Producer not found");
      return;
    }

    const peer = this.peers.get(socket.id);

    if (!peer) {
      console.error("Peer not found");
      return;
    }

    const transport = peer.transports.find((t) => t.consumer)?.transport;

    if (!transport) {
      console.error("Transport not found");
      return;
    }

    const router = this.getRouter(roomId);

    if (!router) {
      console.error("Router not found");
      return;
    }

    if (router.canConsume({ producerId, rtpCapabilities })) {
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      consumer.on("transportclose", () => {
        console.log("Consumer transport closed");
      });

      consumer.on("producerclose", () => {
        console.log("Producer closed");
        //TO remove from the list (frontend)
        socket.emit("producer-closed", { producerId });

        consumer.close();
        this.roomManager.removeConsumer(consumer.id, roomId);
      });

      this.roomManager.addConsumer(consumer, roomId);

      return {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };
    }
    return {
      error: "No suitable producer",
    };
  }

  informAllConsumers(roomId: string, producerId: string, socketId: string) {
    this.roomManager.informAllConsumers(roomId, producerId, socketId);
  }

  async resumeConsumer(roomId: string, consumerId: string) {
    const consumer = this.roomManager.getConsumer(roomId, consumerId);
    if (!consumer) {
      console.error("Consumer not found");
      return;
    }

    await consumer.resume();
  }
}
