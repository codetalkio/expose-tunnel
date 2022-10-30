const { spawn } = require("child_process");

const { DEBUG_OUTPUT } = require("./constants.js");
let saveTunnelUrl = undefined;
let saveTunnelFailed = undefined;

/**
 * Helper funciton to await a defined amount of time.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for the tunnel service to receive its URL from stdout, before it will then store this output
 * in a file that we can pick up.
 *
 * NOTE: We wait about 10 seconds (50 * 200ms = 10,000ms = 10s).
 */
const waitForTunnelToBeReady = async () => {
  console.log(`>> Waiting for tunnel url to be set.`);
  for (let i = 0; i < 50; i++) {
    if (!saveTunnelUrl && !saveTunnelFailed) {
      await delay(200);
    }
  }
  const tunnelUrl = saveTunnelUrl;
  const tunnelFailed = saveTunnelFailed;
  if (tunnelFailed) {
    saveTunnelUrl = undefined;
    saveTunnelFailed = undefined;
  }

  return {
    tunnelUrl,
    tunnelFailed,
  };
};

/**
 * Start a tunnel as a child process, and listen for its stdout.
 */
const startTunnelProcess = (command, arguments, parseOutput, parseError) => {
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
      saveTunnelUrl = tunnelUrl;
    }
  });

  tunnel.stderr.on("data", (data) => {
    const stringData = `${data}`;
    if (!stringData) {
      return;
    }
    if (DEBUG_OUTPUT) {
      console.error(`stderr: ${data}`);
    }
    if (parseError) {
      const failed = parseError(stringData);
      if (failed) {
        saveTunnelFailed = true;
      }
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
