const { Service } = require("node-windows");
const path = require("path");

const svc = new Service({
  name: "StationAgentService",
  description: "Station Agent Background Service",
  script: path.join(__dirname, "service-launcher.js"),
  nodeOptions: [],
});

svc.on("install", () => {
  svc.start();
  console.log("Service installed and started");
});

svc.install();
