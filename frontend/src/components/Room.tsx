import { Device } from "mediasoup-client";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import React from "react";
import { useParams } from "react-router";
import { io, Socket } from "socket.io-client";

export default function Room() {
  let { roomId } = useParams();
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [localAudioTrack, setLocalAudioTrack] =
    React.useState<MediaStreamTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] =
    React.useState<MediaStreamTrack | null>(null);

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
        stream.getTracks().forEach((track) => {
          if (track.kind === "audio") {
            setLocalAudioTrack(track);
          }
          if (track.kind === "video") {
            setLocalVideoTrack(track);
          }
        });
      }
    };

    const createPeer = async () => {
      newSocket.emit("create-peer", {});
    };

    const joinRoom = async () => {
      newSocket.emit("join-room", { roomId }, (data: any) => {
        console.log("joined room", data.rtpCapabilities);
        createDevice(data.rtpCapabilities);
      });
    };

    const createDevice = async (rtpCapabilities: RtpCapabilities) => {
      try {
        device = new Device();

        await device.load({
          routerRtpCapabilities: rtpCapabilities,
        });

        console.log("Device created RTP Capabilities", device.rtpCapabilities);
      } catch (error: any) {
        console.log(error);
        if (error.name === "UnsupportedError") {
          console.error("browser not supported");
        }
        throw error;
      }
    };

    const createProducerTransport = async () => {
      socket?.emit("create-transport", { consumer: false });
    };

    newSocket.on("connection-success", async ({ socketId }) => {
      console.log(`Connected with socketId: ${socketId}`);

      await getLocalStream();

      try {
        createPeer();

        await joinRoom();

        createProducerTransport();
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
