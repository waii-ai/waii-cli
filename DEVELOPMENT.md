# Waii CLI Development Guide

## Point Waii CLI to different Waii endpoints

If you want to point Waii to your local Waii instance, you can do so by modifying the `~/.waii/conf.yaml` file.

First you need to get API key from your local Waii instance. You can do so by running the following command in your local Waii instance (Assume the Waii Python server is running on port 9859):

```bash
curl -X 'POST' \
'http://localhost:9859/api/get-access-key' \
-H 'accept: application/json' \
-H 'Content-Type: application/json' \
-d '{}'
```

Modify `~/.waii/conf.yaml` to

```yaml
#url: http://localhost:9859/api/
url: https://tweakit.waii.ai/api/
apiKey: <The API key you get from the previous step>
```

## Make change to the code and test it locally

If you make any changes to the code, you need to run `tsc` to compile the code.

After that, you can run `node . <...>` inside `waii-cli` folder to test your changes.

For example, for command `waii database list`, you need to run `node . database list` to test the local changes.

## Test with local changes from `waii-sdk-js`

It is possible that you made some changes in`waii-sdk-js`, and want to test the changes in `waii-cli` before publishing the changes to npm.

To do so, you need to run `tsc && npm pack` inside the `waii-sdk-js` folder. After that, you need to run
1. `npm uninstall waii-sdk-js` and
2. `npm install <path-to-waii-sdk-js>/waii-sdk-js-<version>.tgz` inside the `waii-cli` folder.

After that, you can run `node . <...>` inside `waii-cli` folder to test your changes.

However, be careful that such commands may change package.json package.lock.json files. You may need to revert the changes after testing.

## Generate doc

Run 

```
tsc
node . docs generate
```

to refresh doc. 


## Publish to NPM
First, you need to login to NPM by running `npm login`. if you don't have an account, or your account doesn't have the permission to publish the package, please contact the Waii team.
Then, you need to bump up the version number in `package.json`
Run `npm pack && npm publish` to publish the package to NPM.
