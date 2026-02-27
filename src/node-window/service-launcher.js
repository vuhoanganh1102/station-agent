const { spawn } = require("child_process");
const path = require("path");

const exePath = "C:\\Program Files\\StationAgent\\StationAgent.exe";

spawn(exePath, [], {
  detached: true,
  stdio: "ignore",
});

process.exit();
