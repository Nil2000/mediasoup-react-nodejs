import { Device } from "mediasoup-client";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { Consumer, Transport } from "mediasoup-client/lib/types";
import React from "react";
import { useParams } from "react-router";
import { io, Socket } from "socket.io-client";

export default function Room() {
  let { roomId } = useParams();
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const localAudioTrackRef = React.useRef<MediaStreamTrack | null>(null);
  const localVideoTrackRef = React.useRef<MediaStreamTrack | null>(null);
  const consumingTransportRef = React.useRef<string[]>([]);
  const consumerTransportRef = React.useRef<Transport | null>(null);

  React.useEffect(() => {
    let device: Device;
    // let consumers=new Map<string,Consumer[]>();
    const newSocket = io("http://localhost:3000/call");

    const getLocalStream = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          height: {
            min: 400,
            max: 1080,
          },
          width: {
            min: 640,
            max: 1920,
          },
        },
        audio: true,
      });
      const localVideo = document.getElementById(
        "localVideo"
      ) as HTMLVideoElement;
      if (localVideo) {
        localVideo.srcObject = new MediaStream(stream.getVideoTracks());
        console.log("Local Stream", stream.getTracks());
        stream.getTracks().forEach((track) => {
          if (track.kind === "audio") {
            localAudioTrackRef.current = track;
          }
          if (track.kind === "video") {
            localVideoTrackRef.current = track;
          }
        });
        createPeer();
      }
    };

    const createPeer = async () => {
      newSocket.emit("create-peer", { roomId }, () => {
        console.log("Peer created");
      });
    };

    const joinRoom = async () => {
      newSocket.emit("join-room", { roomId }, async (data: any) => {
        console.log("joined room", data.rtpCapabilities);
        await createDevice(data.rtpCapabilities);
      });
    };

    const createDevice = async (rtpCapabilities: RtpCapabilities) => {
      try {
        device = new Device();

        await device.load({
          routerRtpCapabilities: rtpCapabilities,
        });

        console.log("Device created RTP Capabilities", device.rtpCapabilities);

        createProducerTransport();
      } catch (error: any) {
        console.log(error);
        if (error.name === "UnsupportedError") {
          console.error("browser not supported");
        }
        throw error;
      }
    };

    const createProducerTransport = async () => {
      newSocket.emit(
        "create-transport",
        { roomId, consumer: false },
        ({ params }: any) => {
          if (params.error) {
            console.error(params.error);
            return;
          }
          console.log("Producer Transport params created->", params);

          const producerTransport = device.createSendTransport(params);

          producerTransport.on(
            "connect",
            async ({ dtlsParameters }, callback, errback) => {
              try {
                newSocket.emit("connect-transport", {
                  dtlsParameters,
                  roomId,
                  consumer: false,
                });

                callback();
              } catch (error: any) {
                errback(error);
              }
            }
          );

          producerTransport.on("produce", async (params, callback, errback) => {
            console.log("Produce event", params);

            try {
              newSocket.emit(
                "produce-transport",
                {
                  roomId,
                  consumer: false,
                  kind: params.kind,
                  rtpParameters: params.rtpParameters,
                  appData: params.appData,
                },
                ({ id, producersExist }: any) => {
                  callback({ id });

                  //get producers
                  if (producersExist) {
                    getProducers();
                  }
                }
              );
            } catch (error: any) {
              errback(error);
            }
          });

          //connect transport
          connectProducerTransport(producerTransport);
        }
      );
    };

    const connectProducerTransport = async (producerTransport: Transport) => {
      console.log(localAudioTrackRef.current, localVideoTrackRef.current);

      const audioProducer = await producerTransport.produce({
        track: localAudioTrackRef.current!,
      });
      const videoProducer = await producerTransport.produce({
        track: localVideoTrackRef.current!,
        encodings: [
          {
            rid: "r0",
            maxBitrate: 100000,
            scalabilityMode: "S1T3",
          },
          {
            rid: "r1",
            maxBitrate: 300000,
            scalabilityMode: "S1T3",
          },
          {
            rid: "r2",
            maxBitrate: 900000,
            scalabilityMode: "S1T3",
          },
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000,
        },
      });

      audioProducer.on("transportclose", () => {
        console.log("audio transport close");
      });

      videoProducer.on("transportclose", () => {
        console.log("video transport close");
      });

      audioProducer.on("trackended", () => {
        console.log("audio track ended");
      });

      videoProducer.on("trackended", () => {
        console.log("video track ended");
      });
    };

    const getProducers = () => {
      newSocket.emit("get-producers", { roomId }, (producerIds: string[]) => {
        producerIds.forEach(async (producerId) => {
          await handleNewConsumerTransport(producerId);
        });
      });
    };

    const handleNewConsumerTransport = async (remoteProducerId: string) => {
      if (consumingTransportRef.current.includes(remoteProducerId)) {
        return;
      }
      consumingTransportRef.current.push(remoteProducerId);
      console.log("Creating consumer transport for ->", remoteProducerId);
      newSocket.emit(
        "create-transport",
        { roomId, consumer: true },
        async ({ params }: any) => {
          if (params.error) {
            console.error(params.error);
            return;
          }
          if (!consumerTransportRef.current) {
            const consumerTransport = device.createRecvTransport(params);

            consumerTransport.on(
              "connect",
              async ({ dtlsParameters }, callback, errback) => {
                try {
                  newSocket.emit("connect-transport", {
                    dtlsParameters,
                    roomId,
                    consumer: true,
                  });
                  callback();
                } catch (error: any) {
                  errback(error);
                }
              }
            );
            consumerTransportRef.current = consumerTransport;
          }

          await consumeReceiverTransport(
            consumerTransportRef.current,
            remoteProducerId
          );
        }
      );
    };

    const consumeReceiverTransport = async (
      consumerTransport: Transport,
      remoteProducerId: string
    ) => {
      newSocket.emit(
        "consume-transport",
        { roomId, remoteProducerId, rtpCapabilities: device.rtpCapabilities },
        async ({ params }: any) => {
          if (params.error) {
            console.error(params.error);
            return;
          }

          console.log("Consuming transport", params);

          const consumer = await consumerTransport.consume(params);
          console.log(consumer.track);
          if (params.kind === "video") {
            const newContainer = document.createElement("div");
            newContainer.setAttribute("id", `container_${remoteProducerId}`);
            newContainer.setAttribute("class", "container");
            newContainer.innerHTML = `<video id="remoteVideo_${remoteProducerId}" autoplay playsinline></video>`;
            document
              .getElementById("remoteVideoContainer")
              ?.appendChild(newContainer);

            const remoteVideo = document.getElementById(
              `remoteVideo_${remoteProducerId}`
            ) as HTMLVideoElement;

            remoteVideo.srcObject = new MediaStream([consumer.track]);
          } else if (params.kind === "audio") {
            const newContainer = document.createElement("div");
            newContainer.setAttribute("id", `container_${remoteProducerId}`);
            newContainer.innerHTML = `<audio id="remoteAudio_${remoteProducerId}" autoplay playsinline></audio>`;
            document
              .getElementById("remoteVideoContainer")
              ?.appendChild(newContainer);

            const remoteAudio = document.getElementById(
              `remoteAudio_${remoteProducerId}`
            ) as HTMLAudioElement;

            remoteAudio.srcObject = new MediaStream([consumer.track]);

            remoteAudio.play();
          }

          newSocket.emit("resume-consumer", {
            roomId,
            serverConsumerId: params.id,
          });
        }
      );
    };

    newSocket.on("new-producer", async ({ producerId }) => {
      console.log("New Producer", producerId);
      await handleNewConsumerTransport(producerId);
    });

    newSocket.on("connection-success", async ({ socketId }) => {
      console.log(`Connected with socketId: ${socketId}`);

      await getLocalStream();
      try {
        await joinRoom();
      } catch (error) {
        console.log(error);
      }
    });

    newSocket.on("producer-closed", ({ producerId }) => {
      console.log("Producer closed", producerId);
      const container = document.getElementById(
        `container_${producerId}`
      ) as HTMLElement;
      container.remove();
    });

    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <div>
      Room:{roomId}
      <div>
        <video id="localVideo" autoPlay playsInline></video>
        {/* <div >

        </div> */}
        <div id="remoteVideoContainer"></div>
      </div>
    </div>
  );
}
