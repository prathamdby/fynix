const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const Redis = require("ioredis");
const { config } = require("dotenv");

config();

const publisher = new Redis(process.env.REDIS_URL);

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const PROJECT_ID = process.env.PROJECT_ID;
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

function publishLog(log) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

const init = async () => {
  console.log("Executing script.js");
  publishLog("Build started...");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath}; npm install; npm run build`);

  p.stdout.on("data", (data) => {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.stdout.on("error", (data) => {
    console.log(`Error: ${data.toString()}`);
    publishLog(`Error: ${data.toString()}`);
  });

  p.on("close", async () => {
    console.log("Build complete");
    publishLog("Build complete");

    const distFolderPath = path.join(outDirPath, "dist");
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });

    publishLog("Starting to upload");
    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file);
      if (fs.lstatSync(filePath).isDirectory()) continue;

      console.log(`Uploading ${filePath}`);
      publishLog(`Uploading ${file}`);

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `__outputs/${PROJECT_ID}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);

      console.log(`Uploaded ${filePath}`);
      publishLog(`Uploaded ${filePath}`);
    }

    console.log("Done...");
    publishLog("Done");
  });
};

init();
