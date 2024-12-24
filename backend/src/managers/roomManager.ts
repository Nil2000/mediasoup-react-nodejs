import { Router } from "mediasoup/node/lib/RouterTypes";
import { Peer } from "./userManager";
import { worker } from "../utils/worker";
import { Socket } from "socket.io";
import { RtpCapabilities } from "mediasoup/node/lib/rtpParametersTypes";
import { Consumer, Producer, Transport } from "mediasoup/node/lib/types";

export interface Room {
  peers: Peer[];
  router: Router;
  transports: Transport[];
  producers: Producer[];
  consumers: Consumer[];
}

// let worker = createWorker();

export class RoomManager {
  private rooms: Map<string, Room>;
  private worker = worker;

  constructor() {
    this.rooms = new Map();
    console.log("Room Manager initialized");
  }

  async createRoom(roomId: string) {
    const router = await this.worker.createRouter();
    this.rooms.set(roomId, {
      peers: [],
      router,
      transports: [],
      producers: [],
      consumers: [],
    });
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  async addUsertoRoom(roomId: string, user: Peer) {
    let room = this.getRoom(roomId);
    if (!room) {
      await this.createRoom(roomId);
      room = this.rooms.get(roomId);
    }
    room?.peers.push(user);
  }

  removeUserFromRoom(roomId: string, socketId: string) {
    let room = this.rooms.get(roomId);
    if (!room) {
      console.log("Room not found");
      return;
    }
    room.peers = room.peers.filter((user) => user.socket.id !== socketId);

    if (room.peers.length === 0) {
      room.router.close();
      this.rooms.delete(roomId);
    }
  }

  getRouterCapabilities(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    return room.router.rtpCapabilities;
  }
  //TODO: Consider peer rather than user and do related ops like createTransport, createProducer, createConsumer etc
  // handlePeerConnection({socketId,})
}
