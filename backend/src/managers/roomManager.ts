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
  WebRtcTransport,
} from "mediasoup/node/lib/types";

export interface Room {
  peers: Peer[];
  router: Router;
  maxPeers: number;
  transports: {
    socketId: string;
    transport: WebRtcTransport;
    consumer: boolean;
  }[];
  producers: { socketId: string; producer: Producer; kind: string }[];
  consumers: Consumer[];
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
      transports: [],
      producers: [],
      consumers: [],
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

  getRouter(roomId: string) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return null;
    }
    return room.router;
  }

  addTransport(
    socketId: string,
    roomId: string,
    transport: WebRtcTransport,
    consumer: boolean
  ) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return;
    }

    const existingTransport = room.transports.find(
      (t) => t.socketId === socketId && t.consumer === consumer
    )?.transport;

    if (existingTransport) {
      return;
    }

    this.rooms.get(roomId)?.transports.push({ socketId, transport, consumer });

    console.log(this.rooms.get(roomId)?.transports);
  }

  async connectTransport(
    socketId: string,
    roomId: string,
    dtlsParameters: any,
    consumer: boolean
  ) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return;
    }

    console.log("CONNECT_TRANSPORT", socketId, consumer);
    const transport = room.transports.find(
      (t) => t.socketId === socketId && t.consumer === consumer
    )?.transport;
    if (!transport) {
      console.error("Transport not found");
      return;
    }
    console.log(transport.dtlsState);
    if (transport.dtlsState === "connected") {
      console.log("Transport already connected");
      return;
    }
    await transport.connect({ dtlsParameters });
  }

  // async produceTransport(socketId: string, data: any) {
  //   console.log("ROOM_MANAGER_PRODUCE_TRANSPORT", socketId, data);
  //   const room = this.getRoom(data.roomId);
  //   if (!room) {
  //     console.error("Room not found");
  //     return;
  //   }

  //   const transport = room.transports.find(
  //     (t) => t.socketId === socketId && t.consumer === data.consumer
  //   );
  //   if (!transport) {
  //     console.error("Transport not found");
  //     return;
  //   }

  //   const producer = await transport.transport.produce({
  //     kind: data.kind,
  //     rtpParameters: data.rtpParameters,
  //   });

  //   return producer;
  // }

  addProducer(
    socketId: string,
    roomId: string,
    producer: Producer,
    kind: string
  ) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return;
    }
    room.producers.push({
      socketId,
      producer,
      kind,
    });
  }

  addConsumer(consumer: Consumer, roomId: string) {
    console.log("Consumer added");

    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return;
    }

    room.consumers.push(consumer);
  }

  removeConsumer(consumerId: string, roomId: string) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return;
    }

    room.consumers = room.consumers.filter(
      (consumer) => consumer.id !== consumerId
    );
  }

  getOtherProducerLength(socketId: string, roomId: string) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return;
    }
    return room.producers.filter((producer) => producer.socketId !== socketId)
      .length;
  }

  getOtherProducers(roomId: string, socketId: string) {
    let producers: string[] = [];

    const room = this.getRoom(roomId);

    if (!room) {
      console.error("Room not found");
      return;
    }

    room.producers.forEach((producer) => {
      if (producer.socketId !== socketId) {
        producers.push(producer.producer.id);
      }
    });
    return producers;
  }

  async connectRecieverTransport(
    socketId: string,
    roomId: string,
    dtlsParameters: any,
    consumer: boolean
  ) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.error("Room not found");
      return;
    }

    const transport = room.transports.find(
      (t) => t.socketId === socketId && t.consumer === consumer
    )?.transport;
    if (!transport) {
      console.error("Transport not found");
      return;
    }

    await transport.connect({ dtlsParameters });
  }

  getProducer(roomId: string, producerId: string) {
    const room = this.getRoom(roomId);

    if (!room) {
      console.error("Room not found");
      return;
    }

    return room.producers.find(
      (producer) => producer.producer.id === producerId
    )?.producer;
  }

  getConsumer(roomId: string, consumerId: string) {
    const room = this.rooms.get(roomId);

    if (!room) {
      console.error("Room not found");
      return;
    }

    return room.consumers.find((consumer) => consumer.id === consumerId);
  }

  informAllConsumers(roomId: string, producerId: string, socketId: string) {
    console.log("Informing all consumers");

    const room = this.getRoom(roomId);

    if (!room) {
      console.error("Room not found");
      return;
    }

    room.peers.forEach((peer) => {
      if (peer.socket.id !== socketId) {
        peer.socket.emit("new-producer", { producerId });
      }
    });
  }
}
