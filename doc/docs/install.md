---
id: install
title: Installation
---

## Prerequisites:
- Node.js (version >= 16)

### Installation:

#### Make sure you have Node.js (version >= 16) installed.
   - You can check your Node.js version by running `node -v` in the terminal.
   - If you don't have Node.js installed, you can download it from [Node.js official website](https://nodejs.org/).

### Install Waii-CLI globally using npm:

```bash
npm install -g waii-cli
```

### Set your API key.
Login to https://tweakit.waii.ai/, you need to get username/password to access it first. Go to Settings -> Copy API Key to get your API key.
Create ~/.waii/conf.yaml on your local laptop and add your api key.
```yaml
url: https://tweakit.waii.ai/api/
apiKey: <your-api-key>
```

### Test it:

Run
```
waii database describe
```
You should be able to see the content from Waii playground database:
```
┌──────────┐
│ database │
├──────────┤
│ WAII     │
└──────────┘
┌─────────────────────────┬────────┐
│ schema                  │ tables │
├─────────────────────────┼────────┤
│ WAII.INFORMATION_SCHEMA │ 31     │
│ WAII.CINE_TELE_DATA     │ 3      │
└─────────────────────────┴────────┘
```
