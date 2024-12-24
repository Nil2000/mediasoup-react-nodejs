import { Router } from "mediasoup/node/lib/RouterTypes";
import { User } from "./userManager";
import { worker } from "../utils/worker";
import { Socket } from "socket.io";
import { RtpCapabilities } from "mediasoup/node/lib/rtpParametersTypes";

export interface Room {
  users: User[];
  router: Router;
}

export interface Broadcaster {
  rtpCapabilities: RtpCapabilities;
  transports: Map<string, any>;
  producers: Map<string, any>;
  consumers: Map<string, any>;
}

// let worker = createWorker();

export class RoomManager {
  private rooms: Map<string, Room>;
  private broadcasters: Map<string, Broadcaster>;
  private worker = worker;

  constructor() {
    this.rooms = new Map();
    this.broadcasters = new Map();
    console.log("Room Manager initialized");
  }

  async createRoom(roomId: string) {
    const router = await this.worker.createRouter();
    this.rooms.set(roomId, { users: [], router });
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  async addUsertoRoom(roomId: string, user: User) {
    let room = this.rooms.get(roomId);
    if (!room) {
      await this.createRoom(roomId);
      room = this.rooms.get(roomId);
    }
    room?.users.push(user);
  }

  removeUserFromRoom(roomId: string, userId: string) {
    let room = this.rooms.get(roomId);
    if (!room) {
      console.log("Room not found");
      return;
    }
    room.users = room.users.filter((user) => user.userId !== userId);

    if (room.users.length === 0) {
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

  createBroadCaster(roomId: string, rtpCapabilities: RtpCapabilities) {
    this.broadcasters.set(roomId, {
      rtpCapabilities: rtpCapabilities,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    });
  }
  //TODO: Consider peer rather than user and do related ops like createTransport, createProducer, createConsumer etc
  // handlePeerConnection({socketId,})
}
