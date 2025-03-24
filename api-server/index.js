const express = require("express");
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { Server } = require("socket.io");
const Redis = require("ioredis");

require("dotenv").config();

const app = express();
const PORT = 9000;

const ecsClient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const subscriber = new Redis(process.env.REDIS_URL);

const io = new Server({ cors: "*" });

io.listen(9002, () => console.log("Socket Server 9002"));

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});

const config = {
  CLUSTER: process.env.ECS_CLUSTER_ARN,
  TASK: process.env.ECS_TASK_DEFINITION_ARN,
};

app.use(express.json());

app.post("/project", async (req, res) => {
  const { gitURL, slug } = req.body;

  const projectSlug = slug ?? generateSlug();

  // Spin up the container

  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: process.env.SUBNETS.split(","),
        securityGroups: process.env.SECURITY_GROUPS.split(","),
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "builder-image",
          environment: [
            {
              name: "GIT_REPOSITORY_URL",
              value: gitURL,
            },
            {
              name: "PROJECT_ID",
              value: projectSlug,
            },
            {
              name: "AWS_ACCESS_KEY_ID",
              value: process.env.AWS_ACCESS_KEY_ID,
            },
            {
              name: "AWS_SECRET_ACCESS_KEY",
              value: process.env.AWS_SECRET_ACCESS_KEY,
            },
            {
              name: "AWS_REGION",
              value: process.env.AWS_REGION,
            },
            {
              name: "AWS_BUCKET_NAME",
              value: process.env.AWS_BUCKET_NAME,
            },
            {
              name: "REDIS_URL",
              value: process.env.REDIS_URL,
            },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  return res.json({
    status: "queued",
    data: {
      projectId: projectSlug,
      url: `http://${projectSlug}.localhost:8000`,
    },
  });
});

async function initRedisSubscribe() {
  console.log("Subscribing to logs...");
  subscriber.psubscribe("logs:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    io.to(channel).emit("message", message);
  });
}

initRedisSubscribe();

app.listen(PORT, () => console.log(`API Server Running...${PORT}`));
