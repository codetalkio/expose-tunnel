const { RESOURCES_FOLDER } = require("./constants.js");
const { waitForTunnelToBeReady, startTunnelProcess } = require("./helper.js");

/**
 * We start the SSH tunnel to localhost.run and return the tunnel url.
 */
const startTunnel = async (port, endpoint) => {
  /**
   *  Parse the URL out of the output string that looks roughly like the following:
   * ```
   * 2022-10-30T14:39:45.808729Z  INFO bore_cli::client: listening at bore.pub:41935
   * ```
   */
  const parseOutput = (stdout) => {
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
  };

  /**
   *  Parse the URL out of the output string that looks roughly like the following:
   *
   * ```
   *     failed to lookup address information: Name does not resolve
   * ```
   *
   * or
   *
   * ```
   *      Connection refused (os error 61)
   * ```
   */
  const parseError = (stderr) => {
    if (
      stderr.includes("failed to lookup address") ||
      stderr.includes("Connection refused")
    ) {
      return true;
    }
    return false;
  };

  const tunnel = startTunnelProcess(
    `${RESOURCES_FOLDER}/bore`,
    ["local", port, `--to`, endpoint],
    parseOutput,
    parseError
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
