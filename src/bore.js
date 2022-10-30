const { RESOURCES_FOLDER } = require("./constants.js");
const { waitForTunnelToBeReady, startTunnelProcess } = require("./helper.js");

/**
 * We start the SSH tunnel to localhost.run and return the tunnel url.
 */
const startTunnel = async (port, endpoint) => {
  const tunnel = startTunnelProcess(
    `${RESOURCES_FOLDER}/bore`,
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
      const url = `http://${endpoint}${cleanUrlPart}`
        .replace(/\r?\n|\r/g, "")
        .trim();
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
