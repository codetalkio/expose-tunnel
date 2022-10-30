# expose-tunnel [![CI: Test Tunnel Forwarding](https://github.com/codetalkio/expose-tunnel/actions/workflows/ci.yml/badge.svg)](https://github.com/codetalkio/expose-tunnel/actions/workflows/ci.yml)
> Easily create tunnels to access your GitHub Action workflows from public endpoints.

There are many services and tools that exist to create tunnels to your localhost and create a public URL that other people can access those services on:
- Create tunnels from various supported services ([localhost.run](http://localhost.run) and [bore.pub](https://github.com/ekzhang/bore))
- Provide fallback strategies if the primary service is unavailable
- Makes the tunnel URL easily accessible to other steps in your workflow

This action makes it easy to do this from within a GitHub Action, which can be a powerful and easy way to interact with services you have running inside the workflows, or even create Preview Environments so that reviewers can easily test your changes, or you can share the generated URL to users in your organization that might not be on GitHub.

- [Usage](#usage)
    - [Arguments](#arguments)
- [Usecases](#usecases)
    - [React to a comment](#react-to-a-comment)
    - [Post the Tunnel URL as a comment on a Pull Request](#post-the-tunnel-url-as-a-comment-on-a-pull-request)
    - [Post the Tunnel URL to a Slack Channel](#post-the-tunnel-url-to-a-slack-channel)

# Usage

```yaml
steps:
- uses: actions/checkout@v3

- name: Starting services
  run: echo "Start up your services before exposing them...."

- uses: codetalkio/expose-tunnel@v1
  id: expose-tunnel
  with:
    service: bore.pub
    port: 8080

- name: Accessing the tunnel url
  run: echo "Tunnel has been started at '${{ steps.expose-tunnel.outputs.tunnel-url }}'"

- name: Keep tunnel alive for a defined time
  run: timeout 30m sleep 7200 # Stop on whichever we reach first (30m or 2hour sleep).
```

### Arguments

The following arguments are supported:

| Argument | Required | Description | Default | Options |
| -------- | -------- | ----------- | ------- | ------- |
| `service`  | Yes      | Which tunneling service to use | N/A | - [bore.pub](https://github.com/ekzhang/bore) (managed service)<br>- [bore.selfhosted](https://github.com/ekzhang/bore#self-hosting) (self-hosting)<br>- [localhost.run](http://localhost.run) (managed service) |
| `port` | Yes | The local port we are creating a tunnel to | `80` | Any port you want |
| `selfHostedEndpoint` | No, unless [bore.selfhosted](https://github.com/ekzhang/bore#self-hosting) was specified as the `service` | The endpoint to the self-hosted service | N/A | N/A |
| `fallback` | No | Fallback strategy if the preferred `service` isn't available (e.g. self-hosted is down, fallback to managed service) | `'[]'` | All services |
| `blocking` | No | If the step should block and keep the job alive for the specified amount of time. This means you won't be able to use the output in later steps since the tunnel will be closing after the step. | `false` | `false` or any minute number, specificed as `<num>m` e.g. `30m` (max is `120m`) |

Putting all these into play could look like this:

```yaml
steps:
- uses: actions/checkout@v3

- name: Starting services
  run: echo "Start up your services before exposing them...."

- uses: codetalkio/expose-tunnel@v1
  id: expose-tunnel
  with:
    service: bore.selfhosted
    port: 8080
    selfHostedEndpoint: my-own-servers.run
    fallback: '["bore.pub", "localhost.run"]'
    blocking: 30m # Only do this if you do not plan to do anything with the tunnel url.
```

# Usecases

Here's a couple of common usecases for the expose-tunnel action, and how you can integrate them into your own work environment.

### React to a comment

Start up services and create the tunnel environment when a comment or the first part of a Pull Request starts with the defined trigger (`/preview` in the example here), using the [pull-request-comment-trigger](https://github.com/marketplace/actions/pull-request-comment-trigger) action:

```yaml
- uses: khan/pull-request-comment-trigger@master
  id: check
  with:
      trigger: '/preview'
      reaction: rocket
      prefix_only: true
  env:
      GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}'

- uses: actions/checkout@v3
  if: steps.check.outputs.triggered == 'true'

- name: Starting services
  if: steps.check.outputs.triggered == 'true'
  run: echo "Start up your services before exposing them...."

- uses: codetalkio/expose-tunnel@v1
  if: steps.check.outputs.triggered == 'true'
  id: expose-tunnel
  with:
    service: bore.pub
    port: 8080

# Check the other usecases for posting the URL on the Pull Request or in Slack.
# ...

- name: Keep tunnel alive for a defined time
  run: timeout 30m sleep 7200 # Stop on whichever we reach first (30m or 2hour sleep).
```

### Post the Tunnel URL as a comment on a Pull Request

We can easily use GitHub's own scripting action to post a comment on a Pull Request:

```yaml
steps:
- uses: actions/checkout@v3

- name: Starting services
  run: echo "Start up your services before exposing them...."

- uses: codetalkio/expose-tunnel@v1
  id: expose-tunnel
  with:
    service: bore.pub
    port: 8080

- name: Post tunnel url as comment on PR
  uses: actions/github-script@v6
  with:
      github-token: ${{secrets.GITHUB_TOKEN}}
      script: |
          github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `**Preview Environment:** ${{ steps.expose-tunnel.outputs.tunnel-url }}`
          })

- name: Keep tunnel alive for a defined time
  run: timeout 30m sleep 7200 # Stop on whichever we reach first (30m or 2hour sleep).
```

Alternatively, check out [add-pr-comment](https://github.com/marketplace/actions/add-pr-comment) as a different way of posting the comment:

```yaml
# ...
- name: Post tunnel url as comment on PR
  uses: mshick/add-pr-comment@v1
  with:
    message: |
      **Preview Environment:** ${{ steps.expose-tunnel.outputs.tunnel-url }}
    allow-repeats: true
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
# ...
```



### Post the Tunnel URL to a Slack Channel

```yaml
steps:
- uses: actions/checkout@v3

- name: Starting services
  run: echo "Start up your services before exposing them...."

- uses: codetalkio/expose-tunnel@v1
  id: expose-tunnel
  with:
    service: bore.pub
    port: 8080

# Post to Slack (see https://github.com/slackapi/slack-github-action#technique-2-slack-app for details on how to post to Slack).
- uses: slackapi/slack-github-action@v1.23.0
  with:
    channel-id: 'preview-channel'
    slack-message: "Preview Environment: ${{ steps.expose-tunnel.outputs.tunnel-url }}"
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}

- name: Keep tunnel alive for a defined time
  run: timeout 30m sleep 7200 # Stop on whichever we reach first (30m or 2hour sleep).
```
