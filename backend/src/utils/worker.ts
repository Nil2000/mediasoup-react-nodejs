import mediasoup from "mediasoup";

export async function createWorker() {
  console.log("Worker created");

  const worker = await mediasoup.createWorker({
    rtcMaxPort: 20020,
    rtcMinPort: 20000,
  });

  worker.on("died", () => {
    console.error("Worker died");
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
}
