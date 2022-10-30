const core = require('@actions/core');

const main = () => {
  const service = core.getInput('service');
  const port = core.getInput('port');
  const selfHostedEndpoint = core.getInput('selfHostedEndpoint');
  const fallback = core.getInput('fallback');
  const blocking = core.getInput('blocking');

  console.log({
    service,
    port,
    selfHostedEndpoint,
    fallback,
    blocking
  });


}

main();
