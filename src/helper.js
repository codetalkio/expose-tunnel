const { spawn } = require("child_process");
const fs = require("fs");

const { TUNNEL_URL_FILE, DEBUG_OUTPUT } = require("./constants.js");

/**
 * Helper funciton to await a defined amount of time.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for the tunnel service to receive its URL from stdout, before it will then store this output
 * in a file that we can pick up.
 *
 * NOTE: We wait about 20 seconds (200 * 200ms = 40,000ms = 40s).
 */
const waitForTunnelToBeReady = async () => {
  console.log(`>> Waiting for tunnel file '${TUNNEL_URL_FILE}' to be written.`);
  for (let i = 0; i < 100; i++) {
    if (!fs.existsSync(TUNNEL_URL_FILE)) {
      await delay(200);
    }
  }

  if (!fs.existsSync(TUNNEL_URL_FILE)) {
    console.log(`>> No tunnel file was created '${TUNNEL_URL_FILE}', exiting.`);
    process.exit(1);
  }

  return fs.readFileSync(TUNNEL_URL_FILE, "utf8");
};

/**
 * Start a tunnel as a child process, and listen for its stdout.
 */
const startTunnelProcess = (command, arguments, parseOutput) => {
  // Start the tunnel command with the supplied arguments.
  console.log(`>> Starting tunnel: ${command} ${arguments.join(" ")}`);
  const tunnel = spawn(command, arguments);

  // The url will be logged to stdout, so we look for it, pick it up, and store it
  // in a file called .tunnel-url.
  tunnel.stdout.on("data", (data) => {
    const stringData = `${data}`;
    if (DEBUG_OUTPUT) {
      console.log(`stdout: ${stringData}`);
    }
    if (!stringData) {
      return;
    }
    const tunnelUrl = parseOutput(stringData);
    if (tunnelUrl && tunnelUrl !== "") {
      fs.writeFileSync(TUNNEL_URL_FILE, tunnelUrl, {
        encoding: "utf8",
      });
    }
  });

  tunnel.stderr.on("data", (data) => {
    if (DEBUG_OUTPUT) {
      console.error(`stderr: ${data}`);
    }
  });

  tunnel.on("close", (code) => {
    console.log(`Tunnel process exited with code ${code}`);
  });

  process.on("SIGINT", () => {
    console.log(`Process was terminated with SIGINT (Ctrl-C).`);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log(`Process was terminated with SIGTERM.`);
    process.exit(0);
  });

  return tunnel;
};

module.exports = {
  delay,
  waitForTunnelToBeReady,
  startTunnelProcess,
};
