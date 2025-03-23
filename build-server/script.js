import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { config } from "dotenv";

config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const PROJECT_ID = process.env.PROJECT_ID;
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

const init = async () => {
  console.log("Executing script.js");
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", (data) => {
    console.log(data.toString());
  });

  p.stdout.on("error", (data) => {
    console.log(`Error: ${data.toString()}`);
  });

  p.on("close", async () => {
    console.log("Build complete");

    const distFolderPath = path.join(outDirPath, "output", "dist");
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });
    for (const filePath of distFolderContents) {
      if (fs.lstatSync(filePath).isDirectory()) continue;

      console.log(`Uploading ${filePath}`);

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `__outputs/${PROJECT_ID}/${filePath}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);

      console.log(`Uploaded ${filePath}`);
    }

    console.log("Done...");
  });
};

init();
