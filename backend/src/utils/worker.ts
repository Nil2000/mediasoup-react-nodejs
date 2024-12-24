import * as mediasoup from "mediasoup";

export let worker: mediasoup.types.Worker;

export async function createMediasoupWorker() {
  console.log(`Worker created with pid ${process.pid}`);

  const mediasoupWorker = await mediasoup.createWorker({
    rtcMaxPort: 20020,
    rtcMinPort: 20000,
  });

  console.log(`Worker pid: ${mediasoupWorker.pid}`);

  mediasoupWorker.on("died", () => {
    console.error("Worker died");
    setTimeout(() => process.exit(1), 2000);
  });

  worker = mediasoupWorker;
}
