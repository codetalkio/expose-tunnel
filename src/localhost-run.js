const { waitForTunnelToBeReady, startTunnelProcess } = require("./helper.js");

/**
 * We start the SSH tunnel to localhost.run and return the tunnel url.
 */
const startTunnel = async (port) => {
  /**
   *  Parse the URL out of the output string that looks roughly like the following:
   * ```
   * 5adf5e96447668.lhr.life tunneled with tls termination, https://5adf5e96447668.lhr.life
   * ```
   */
  const parseOutput = (stdout) => {
    const [, restWithUrlPart] = stdout.split("http");
    if (!restWithUrlPart || restWithUrlPart === "") {
      return undefined;
    }
    // Ensure nothing comes after the URL.
    const [cleanUrlPart, ..._rest] = restWithUrlPart.split(" ");
    const url = `http${cleanUrlPart}`.replace(/\r?\n|\r/g, "").trim();
    return url;
  };
  const tunnel = startTunnelProcess(
    "ssh",
    [
      "-o StrictHostKeyChecking=no",
      `-R 80:localhost:${port}`,
      "nokey@localhost.run",
    ],
    parseOutput
  );
  const { tunnelUrl, tunnelFailed } = await waitForTunnelToBeReady();

  return {
    tunnelUrl,
    tunnelFailed,
    tunnelProcess: tunnel,
  };
};

module.exports = {
  startTunnel,
};
