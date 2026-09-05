# The Oven

**Let him cook on Cookie Chain.**

The Oven is a public Cookie Chain cApp (Cookie App) for the [Create an App on Cookie Chain](https://superteam.fun/earn/listing/create-an-app-on-cookie-chain-app/) bounty.

It is a kitchen, not a dashboard clone: you connect **Nightly**, switch onto Cookie Chain, and do real SVM work — on-chain memos into the community Cookie Jar, Cookiebox aggregator swaps, bCOOK liquid staking, DAS scans, and a browser-side **cookie-mcp chef** that answers with live chain data.

**Live app:** [https://khadiscon.github.io/the-oven/](https://khadiscon.github.io/the-oven/)

**Repo:** [https://github.com/khadiscon/the-oven](https://github.com/khadiscon/the-oven)

## What it does

| Station | On-chain / infra | Why it exists |
| --- | --- | --- |
| **Kitchen** | Nightly connect + Cookie genesis switch + live RPC health | Required wallet, required network, live feedback |
| **Bake** | SPL Memo + native COOK transfer to Cookie Jar Vault 1 | Public goods + on-chain social crumbs |
| **Mix** | Cookiebox aggregator `GET /quote` + `POST /swap-tx`, Nightly signs the v0 tx | Cookiebox + Cookieswap liquidity |
| **Stake** | SPL Stake Pool `DepositSol` / `WithdrawSol` for bCOOK | Meaningful program interaction, not a transfer demo |
| **Scan** | Cookiescan token registry + Cookie DAS `getAssetsByOwner` | Analytics + DAS |
| **Chef** | cookie-mcp-style tools in the browser | Health, quote, search, pools, stake, balance, NFTs |
| **Bridge** | Guide to Hyperlane warp route | Submission demo requirement |

## Required features (bounty)

- Wallet connection — **Nightly is required** (Wallet Standard `standard:connect`, plus `changeNetwork` onto Cookie Chain)
- Display connected wallet address
- Transaction execution (bake, swap, stake/unstake)
- Confirmation handling (`confirmed` commitment, explorer link)
- Error handling and user feedback (toasts + chef errors)
- Analytics: slot/epoch/validators, COOK price, pools, token search

## Cookie ecosystem integrations

- **Nightly** — `window.nightly.solana`, genesis `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2`, RPC `https://rpc.cookiescan.io`
- **Cookiebox** — `https://agg.cookiebox.app` (DAMM/CLMM routes)
- **Cookieswap** — pools surface in Cookiescan markets (`COOKIESWAP BAMM` / `CPAMM`)
- **Cookie DAS** — `https://api.cookiescan.io` JSON-RPC (`getAsset`, `getAssetsByOwner`)
- **Cookiescan REST** — `/api/price/cook`, `/api/tokens`, `/api/markets`
- **cookie-mcp** — chef tools mirror the official MCP server (health, quote, search, pools, stake, balance)
- **Cookie Jar** — community vault `568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe`
- **Bake Your Stake** — bCOOK mint `EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz`

## Addresses

```
Cookie Chain RPC          https://rpc.cookiescan.io
WebSocket                 https://wss.cookiescan.io
Genesis hash              9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2
Native COOK mint          So11111111111111111111111111111111111111112
Solana bridged COOK       36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1
Cookie Jar (Vault 1)      568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe
Memo program              MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
Cookiebox DAMM v2         DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY
Cookiebox CLMM            CLMMmWqTtyNSomqXP3kETJy2SGKPdr31USsm4GfbLyKs
Cookieswap BAMM           WTzkPUoprVx7PDc1tfKA5sS7k1ynCgU89WtwZhksHX5
bCOOK mint                EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz
Stake pool                GxbNKNYdtNXQkhDkpHdLDAMX64GxaECgANqdfp6cUGH4
Stake program             GZgs5uREPp6BvDt8eysmhavQPAHBAtjePgV4zfhgd9pH
Hyperlane bridge          https://hyperlane.cookiescan.io
```

## Setup

This is a static ES-module app. No build step, no API keys, no custody.

```bash
git clone https://github.com/khadiscon/the-oven
cd the-oven
# any static server
npx serve .
# or python -m http.server 5173
```

Open the URL in a Chromium browser with [Nightly](https://nightly.app/) installed.

GitHub Pages serves the same files from `main`.

### First-time user path

1. Install Nightly.
2. Bridge COOK from Solana at [hyperlane.cookiescan.io](https://hyperlane.cookiescan.io).
3. Open The Oven and click **Connect Nightly**. Confirm the Cookie Chain network switch (genesis + `rpc.cookiescan.io`).
4. Keep a little COOK for fees (~0.000005 COOK / signature).
5. Bake a crumb, mix a swap, or ask the chef `Quote 1 COOK to bCOOK`.

## How transactions work

Every write is **non-custodial**:

1. The app builds an unsigned transaction (or Cookiebox returns an unsigned v0 tx).
2. Nightly signs in the wallet popup.
3. The app sends to `https://rpc.cookiescan.io` and waits for `confirmed`.
4. Status + Cookiescan explorer link show up in the toast and Kitchen log.

Bake memos are prefixed `OVEN|` so the Cookie Jar wall can filter Oven crumbs from other donations.

## Demo thread

See [DEMO.md](./DEMO.md) for an X-thread draft and Telegram blurb.

## Stack

- Vanilla JS ES modules (no bundler)
- `@solana/web3.js` + `@solana/spl-token` from esm.sh
- Cookie Chain RPC / DAS / Cookiescan / Cookiebox over CORS
- GitHub Pages

## License

MIT. Built for Cookie Chain enjoyers. Not financial advice. Fees are crumbs; swaps can still burn you.
