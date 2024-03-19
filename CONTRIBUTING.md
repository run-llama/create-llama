# Contributing

## Getting Started

Install NodeJS. Preferably v18 using nvm or n.

Inside the `create-llama` directory:

```
npm i -g pnpm ts-node
pnpm install
```

Note: we use pnpm in this repo, which has a lot of the same functionality and CLI options as npm but it does do some things better, like caching.

### Building

When we publish to NPM we will have a [ncc](https://github.com/vercel/ncc) compiled version of the tool. To run the build command, run

```
pnpm run build
```

### Test cases

We are using a set of e2e tests to ensure that the tool works as expected.

We're using [playwright](https://playwright.dev/) to run the tests.
To install it, call:

```
pnpm exec playwright install --with-deps
```

Then you can first install the `create-llama` command locally:

```
pnpm run install-local
```

And then finally run the tests:

```
pnpm run e2e
```

To write new test cases write them in [e2e](/e2e)
