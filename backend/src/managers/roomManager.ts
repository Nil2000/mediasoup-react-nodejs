import { Router } from "mediasoup/node/lib/RouterTypes";
import { Peer } from "./userManager";
import { worker } from "../utils/worker";
import { Socket } from "socket.io";
import {
  RtpCapabilities,
  RtpCodecCapability,
} from "mediasoup/node/lib/rtpParametersTypes";
import {
  AppData,
  Consumer,
  Producer,
  Transport,
} from "mediasoup/node/lib/types";

export interface Room {
  peers: Peer[];
  router: Router;
  maxPeers: number;
}

const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
];
// let worker = createWorker();

export class RoomManager {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map();
    console.log("Room Manager initialized");
  }

  async createRoom(roomId: string) {
    if (this.getRoom(roomId)) {
      console.log("Room already exists");
      return;
    }

    const router = await worker.createRouter({ mediaCodecs });
    this.rooms.set(roomId, {
      peers: [],
      router,
      maxPeers: 10,
    });
    console.log("Room created");
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  async addPeerToRoom(roomId: string, peer: Peer) {
    let room = this.getRoom(roomId);
    if (!room) {
      await this.createRoom(roomId);
      room = this.rooms.get(roomId);
    }
    room?.peers.push(peer);
  }

  removeUserFromRoom(roomId: string, socketId: string) {
    let room = this.getRoom(roomId);
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
    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return null;
    }
    return room.router.rtpCapabilities;
  }
  //TODO: Consider peer rather than user and do related ops like createTransport, createProducer, createConsumer etc
  // handlePeerConnection({socketId,})
}
