import { Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import { Producer, Transport, WebRtcTransport } from "mediasoup/node/lib/types";

export interface Peer {
  socket: Socket;
  displayName?: string;
  transports: WebRtcTransport[];
  producers: Map<string, any>;
  consumers: Map<string, any>;
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
      producers: new Map(),
      consumers: new Map(),
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

  async createTransport(socketId: string, roomId: string) {
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

    const transport = await router.createWebRtcTransport(transport_options);

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
        console.log("Transport closed");
      }
    });

    transport.on("@close", () => {
      console.log("Transport closed", transport.id);
    });

    peer?.transports.push(transport);

    return transport;
  }

  addTransportToRoom(
    socketId: string,
    roomId: string,
    transport: Transport,
    consumer: boolean
  ) {
    this.roomManager.addTransport(socketId, roomId, transport, consumer);
  }

  async connectTransportToRoom(
    socketId: string,
    roomId: string,
    dtlsParameters: any,
    consumer: boolean
  ) {
    await this.roomManager.connectTransport(
      socketId,
      roomId,
      dtlsParameters,
      consumer
    );
  }

  async produceTransportOfRooom(socketId: string, data: any) {
    const producer = await this.roomManager.produceTransport(socketId, data);
    return producer;
  }

  addProducerToRoom(socketId: string, roomId: string, producer: Producer) {
    this.roomManager.addProducer(socketId, roomId, producer);
  }

  getProducerLength(roomId: string) {
    return this.roomManager.getProducerLength(roomId);
  }
}
