const { spawn } = require("child_process");
const fs = require("fs");

const { waitForTunnelToBeReady, startTunnelProcess } = require("./helper.js");

const DEBUG_OUTPUT = true;

/**
 * We start the SSH tunnel to localhost.run and return the tunnel url.
 */
const startTunnel = async (port, endpoint) => {
  const tunnel = startTunnelProcess(
    "./resources/bore",
    ["local", port, `--to`, endpoint],
    (stdout) => {
      // Parse the URL out of the output string that looks roughly like the following:
      // "2022-10-30T14:39:45.808729Z  INFO bore_cli::client: listening at bore.pub:41935"
      const [, restWithUrlPart] = stdout.split(endpoint);
      if (!restWithUrlPart || restWithUrlPart === "") {
        return undefined;
      }
      // Ensure nothing comes after the URL.
      const [cleanUrlPart, ..._rest] = restWithUrlPart.split(" ");
      const url = `${endpoint}${cleanUrlPart}`.replace(/\r?\n|\r/g, "").trim();
      return url;
    }
  );
  const tunnelUrl = await waitForTunnelToBeReady();

  return {
    tunnelUrl,
    tunnelProcess: tunnel,
  };
};

module.exports = {
  startTunnel,
};
