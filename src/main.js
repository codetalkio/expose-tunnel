const fs = require("fs");
const http = require("https");
const childProcess = require("child_process");

const core = require("@actions/core");

const { RESOURCES_FOLDER, TUNNEL_IS_READY_FILE } = require("./constants.js");
const { delay } = require("./helper.js");
const localhostRun = require("./localhost-run.js");
const bore = require("./bore.js");

/**
 * The downloadable files and all information required to post-process them.
 */
const downloadUrl = {
  linux: {
    bore: {
      url: "https://github.com/ekzhang/bore/releases/download/v0.4.0/bore-v0.4.0-x86_64-unknown-linux-musl.tar.gz",
      downloadedFilename: "bore-v0.4.0-x86_64-unknown-linux-musl",
      binary: "bore",
    },
  },
  macOS: {
    intel: {
      bore: {
        url: "https://github.com/ekzhang/bore/releases/download/v0.4.0/bore-v0.4.0-x86_64-apple-darwin.tar.gz",
        downloadedFilename: "bore-v0.4.0-x86_64-apple-darwin",
        binary: "bore",
      },
    },
    arm: {
      bore: {
        url: "https://github.com/ekzhang/bore/releases/download/v0.4.0/bore-v0.4.0-aarch64-apple-darwin.tar.gz",
        downloadedFilename: "bore-v0.4.0-aarch64-apple-darwin",
        binary: "bore",
      },
    },
  },
};

/**
 * Start the tunneling:
 * - Download any necessary binaries
 * - Perform any post-processing required
 * - Start the tunneling service
 * - Extract the tunnel URL and store it in the output `tunnel-url`
 */
const main = async () => {
  const service = core.getInput("service");
  const port = core.getInput("port");
  const secret = core.getInput("secret");
  const selfHostedEndpoint = core.getInput("selfHostedEndpoint");
  const fallback = core.getInput("fallback");
  const blocking = core.getInput("blocking");

  console.log(">> Received input:", {
    service,
    port,
    selfHostedEndpoint,
    secret,
    fallback,
    blocking,
  });

  childProcess.exec(`mkdir -p ${RESOURCES_FOLDER}`);

  let fallbackServices = [];
  if (fallback) {
    console.log("Fallback:", JSON.parse(fallback));
    fallbackServices = JSON.parse(fallback);
  }
  const services = [service, ...fallbackServices];

  // Try all fallbacks.
  let tunnelUrl = undefined;
  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    if (i > 0) {
      console.log(`>> Attempting fallback service '${s}'.`);
    }
    await prepareService(service);
    const tunnel = await startService(s, port, selfHostedEndpoint, secret);
    if (tunnel.tunnelUrl) {
      tunnelUrl = tunnel.tunnelUrl;
      break;
    } else if (tunnel.tunnelFailed) {
      console.error(
        `>> Failed to set up tunnel using service '${s}', proceeding to any fallbacks.`
      );
      continue;
    }
  }
  if (!tunnelUrl) {
    console.error(
      `>> Failed to set up tunnel, it is currently '${tunnelUrl}', exiting.`
    );
    process.exit(1);
  }

  // We store the output in 'tunnel-url' so its accessible outside the step.
  core.setOutput("tunnel-url", tunnelUrl);
  console.log(`>> The tunnel url was: '${tunnelUrl}'.`);

  // Finally, we write a file to indicate that the tunnel is ready and we've done
  // everything we need to do from the script here.
  fs.writeFileSync(TUNNEL_IS_READY_FILE, "OK", {
    encoding: "utf8",
  });
};

/**
 * Start the tunnel service.
 */
const startService = async (service, port, selfHostedEndpoint, secret) => {
  console.log(`>> Starting tunnel to '${service}'..`);
  if (service === "bore.pub") {
    return bore.startTunnel(port, "bore.pub");
  } else if (service === "bore.selfhosted") {
    if (!selfHostedEndpoint || selfHostedEndpoint === "") {
      console.error(
        `When using service ${service}, the value 'selfHostedEndpoint' must be set! It was found to be '${selfHostedEndpoint}'.`
      );
      process.exit(1);
    }
    return bore.startTunnel(port, selfHostedEndpoint, secret);
  } else if (service === "localhost.run") {
    return localhostRun.startTunnel(port);
  }
};

/**
 * Coordinate preperation for the service (e.g. any downloading and post-processing).
 */
const prepareService = async (service) => {
  let downloadUrls = downloadUrl.linux;
  // Handle links to macOS versions of binaries.
  if (process.platform === "darwin") {
    if (process.arch == "x64") {
      downloadUrls = downloadUrl.macOS.intel;
    } else {
      downloadUrls = downloadUrl.macOS.arm;
    }
    console.log(`>> Using macOS binaries for architecture '${process.arch}'.`);
  }
  if (service === "bore.pub") {
    console.log(`>> Service '${service}' selected, this uses the bore tool.`);
    await download(
      downloadUrls.bore.url,
      `${downloadUrls.bore.downloadedFilename}.tar.gz`
    );
    await extractService(
      downloadUrls.bore.downloadedFilename,
      downloadUrls.bore.binary
    );
  } else if (service === "bore.selfhosted") {
    console.log(`>> Service '${service}' selected, this uses the bore tool.`);
    await download(
      downloadUrls.bore.url,
      `${downloadUrls.bore.downloadedFilename}.tar.gz`
    );
    await extractService(
      downloadUrls.bore.downloadedFilename,
      downloadUrls.bore.binary
    );
  } else if (service === "localhost.run") {
    console.log(`>> Service '${service}' selected, this uses SSH directly.`);
  }
};

/**
 * Extract the service from the tar.gz archive.
 */
const extractService = async (downloadedFilename, extractedFilename) => {
  console.log(`>> Extracting file ./${downloadedFilename}.tar.gz`);
  childProcess.exec(
    `cd ${RESOURCES_FOLDER} && tar -xf ./${downloadedFilename}.tar.gz`
  );

  // Sometimes the tar process is not fully done creating the file, before the command exits.
  // We introduce a small check and delay here in that case, before renaming it.
  for (let i = 0; i < 10; i++) {
    if (!fs.existsSync(`${RESOURCES_FOLDER}/${extractedFilename}`)) {
      await delay(200);
    }
  }
};

/**
 * Download a file from a given URL, following redirects.
 */
const download = (url, filename) => {
  filename = `${RESOURCES_FOLDER}/${filename}`;
  console.log(
    `>> Fetching binary from '${url}' and saving it to '${filename}'.`
  );
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filename);
    // Start downloading the binary and pipe the output to a file.
    const mkRequest = (redirectUrl) => {
      return http.get(redirectUrl, (response) => {
        // Handle redirects by recursively calling the `request` function.
        if (response.statusCode === 301 || response.statusCode === 302) {
          return mkRequest(response.headers.location);
        } else if (response.statusCode !== 200) {
          console.error(
            `The url '${url}' failed with HTTP status code '${response.statusCode}'.`
          );
          reject();
        } else {
          response.pipe(file);
        }
      });
    };
    const request = mkRequest(url);

    // Let the callback know that we're done downloading as soon as the filehandler is closed.
    file.on("finish", () => file.close(resolve));

    // If we get an error, we delete the file and fail the program.
    request.on("error", (err) => {
      fs.unlink(filename, () => {
        console.error(">> The request returned an error", err);
        reject();
      });
    });
    file.on("error", (err) => {
      fs.unlink(filename, () => {
        console.error(">> The file returned an error", err);
        reject();
      });
    });
  });
};

/**
 * Start the main function in a way that supports async/await.
 */
(async () => {
  try {
    await main();
  } catch (err) {
    console.error(">> Something went wrong with the program:", err);
    process.exit(1);
  }
})();
