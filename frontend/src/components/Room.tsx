import { Device } from "mediasoup-client";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { Transport } from "mediasoup-client/lib/types";
import React from "react";
import { useParams } from "react-router";
import { io, Socket } from "socket.io-client";

export default function Room() {
  let { roomId } = useParams();
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const localAudioTrackRef = React.useRef<MediaStreamTrack | null>(null);
  const localVideoTrackRef = React.useRef<MediaStreamTrack | null>(null);
  const consumingTransportRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    let device: Device;
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
        localVideo.srcObject = stream;
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
      newSocket.emit("create-peer", {}, () => {
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

    const getProducers = async () => {
      newSocket.emit("get-producers", { roomId }, (producerIds: string[]) => {
        console.log("Producer ids" + producerIds);
      });
    };

    const signalNewConsumerTransport = async (remoteProducerId: string) => {
      if (consumingTransportRef.current.includes(remoteProducerId)) {
        return;
      }

      console.log("Signaling new consumer transport", remoteProducerId);

      newSocket.emit(
        "create-transport",
        { roomId, consumer: true },
        ({ params }: any) => {
          if (params.error) {
            console.error(params.error);
            return;
          }

          const consumerTransport = device.createRecvTransport(params);

          consumerTransport.on(
            "connect",
            async ({ dtlsParameters }, callback, errback) => {
              try {
                newSocket.emit("connect-transport", {
                  dtlsParameters,
                  roomId,
                  consumer: true,
                  remoteProducerId,
                });
                callback();
              } catch (error: any) {
                errback(error);
              }
            }
          );
        }
      );
    };

    newSocket.on("connection-success", async ({ socketId }) => {
      console.log(`Connected with socketId: ${socketId}`);

      await getLocalStream();
      try {
        await joinRoom();
      } catch (error) {
        console.log(error);
      }
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
      </div>
    </div>
  );
}
