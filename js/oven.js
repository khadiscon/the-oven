import { Buffer } from "https://esm.sh/buffer@6.0.3";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  VersionedTransaction,
  Keypair,
  StakeProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_STAKE_HISTORY_PUBKEY,
} from "https://esm.sh/@solana/web3.js@1.98.4";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createApproveInstruction,
} from "https://esm.sh/@solana/spl-token@0.4.13";

globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.global = globalThis;

const RPC = "https://rpc.cookiescan.io";
const DAS = "https://api.cookiescan.io";
const COOKIESCAN = "https://api.cookiescan.io";
const COOKIEBOX = "https://agg.cookiebox.app";
const EXPLORER = "https://cookiescan.io";
const GENESIS = "9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2";
const COOK_MINT = "So11111111111111111111111111111111111111112";
const BCOOK = "EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz";
const COOKHOUSE = "C4yVWDrwXeEUapmw3BkvktHBxCSsM8MfJ3aPVuFonFi5";
const JAR = "568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe";
const MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const STAKE_POOL_PROGRAM = new PublicKey("GZgs5uREPp6BvDt8eysmhavQPAHBAtjePgV4zfhgd9pH");
const STAKE_POOL = new PublicKey("GxbNKNYdtNXQkhDkpHdLDAMX64GxaECgANqdfp6cUGH4");
const BCOOK_PK = new PublicKey(BCOOK);
const RESERVE_STAKE = new PublicKey("GAw1vRQ8R3ohDsSgGZV58dc32W7jYhHtc8DzuiVdvm8F");
const MANAGER_FEE = new PublicKey("6ay8hjir4VZJ38x9sfL44Su8bvDEXmc5FrNyErHyv7G8");
const WITHDRAW_AUTHORITY = PublicKey.findProgramAddressSync(
  [STAKE_POOL.toBuffer(), Buffer.from("withdraw")],
  STAKE_POOL_PROGRAM,
)[0];

const TOKENS = [
  { symbol: "COOK", mint: COOK_MINT, decimals: 9 },
  { symbol: "bCOOK", mint: BCOOK, decimals: 9 },
  { symbol: "COOKHOUSE", mint: COOKHOUSE, decimals: 9 },
];

const connection = new Connection(RPC, "confirmed");
const state = {
  account: null,
  address: null,
  walletName: "Nightly",
  health: null,
  tokens: null,
  lastQuote: null,
};

const $ = (id) => document.getElementById(id);
const short = (s) => (s ? `${s.slice(0, 4)}…${s.slice(-4)}` : "");

function uiToRaw(amount, decimals) {
  const [w, f = ""] = String(amount).trim().split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
}
function rawToUi(raw, decimals) {
  const n = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const w = n / base;
  const frac = (n % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${w}.${frac}` : w.toString();
}
function toast(msg, kind = "") {
  const el = $("toast");
  el.className = `toast show ${kind}`;
  el.innerHTML = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 8000);
}
function logTx(entry) {
  const rows = JSON.parse(localStorage.getItem("oven-txs") || "[]");
  rows.unshift(entry);
  localStorage.setItem("oven-txs", JSON.stringify(rows.slice(0, 12)));
  renderTxLog();
}
function renderTxLog() {
  const rows = JSON.parse(localStorage.getItem("oven-txs") || "[]");
  $("tx-log").innerHTML = rows.length
    ? rows.map((r) => `<div class="tx"><b>${r.kind}</b> · ${r.status}<div class="mono"><a href="${EXPLORER}/tx/${r.sig}" target="_blank">${short(r.sig)}</a></div></div>`).join("")
    : `<div class="tx mono">Nothing baked yet.</div>`;
}
function nightly() {
  return window.nightly?.solana || window.solana || null;
}
async function ensureCookieNetwork() {
  const n = nightly();
  if (!n) return;
  try {
    if (typeof n.changeNetwork === "function") await n.changeNetwork({ genesisHash: GENESIS, url: RPC });
    else if (window.nightly?.solana?.changeNetwork) await window.nightly.solana.changeNetwork({ genesisHash: GENESIS, url: RPC });
  } catch (e) {
    console.warn("changeNetwork", e);
  }
}
async function connectWallet() {
  const n = nightly();
  if (!n) {
    toast(`Nightly was not found. Install it from nightly.app, then refresh.`, "bad");
    window.open("https://nightly.app/", "_blank");
    return;
  }
  await ensureCookieNetwork();
  let address = null;
  let account = null;
  if (n.features?.["standard:connect"]?.connect) {
    const out = await n.features["standard:connect"].connect();
    account = out.accounts?.[0] || n.accounts?.[0];
    address = account?.address;
  } else if (n.connect) {
    await n.connect();
    address = n.publicKey?.toString?.() || n.publicKey;
    account = n.publicKey;
  }
  if (!address) throw new Error("Wallet connected but no address was returned");
  state.address = address;
  state.account = account;
  state.walletName = n.name || "Nightly";
  $("connect-btn").textContent = short(address);
  await refreshWallet();
  toast(`Connected ${short(address)} on Cookie Chain`, "ok");
}
async function disconnectWallet() {
  const n = nightly();
  try {
    await n?.features?.["standard:disconnect"]?.disconnect?.();
    await n?.disconnect?.();
  } catch {}
  state.address = null;
  state.account = null;
  $("connect-btn").textContent = "Connect Nightly";
  $("stat-bal").textContent = "—";
  renderWalletCard();
}
function serializeTx(tx) {
  if (tx instanceof VersionedTransaction) return tx.serialize();
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}
async function signTx(tx) {
  const n = nightly();
  if (!n) throw new Error("Connect Nightly first");
  if (typeof n.signTransaction === "function") return n.signTransaction(tx);
  const feature = n.features?.["solana:signTransaction"]?.signTransaction || n.features?.["standard:signTransaction"]?.signTransaction;
  if (!feature) throw new Error("Wallet cannot sign transactions");
  const account = n.accounts?.[0] || state.account;
  const out = await feature({ account, transaction: serializeTx(tx) });
  const bytes = out[0]?.signedTransaction || out.signedTransaction || out[0];
  if (tx instanceof VersionedTransaction) return VersionedTransaction.deserialize(bytes);
  return Transaction.from(bytes);
}
async function sendAndConfirm(tx, kind, hint) {
  toast(`${kind}: waiting for signature…`);
  const latest = hint || (await connection.getLatestBlockhash("confirmed"));
  if (!(tx instanceof VersionedTransaction)) {
    tx.feePayer = tx.feePayer || new PublicKey(state.address);
    if (!tx.recentBlockhash) tx.recentBlockhash = latest.blockhash;
  }
  const signed = await signTx(tx);
  toast(`${kind}: sending…`);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  const blockhash = hint?.blockhash || (tx instanceof VersionedTransaction ? tx.message.recentBlockhash : tx.recentBlockhash) || latest.blockhash;
  toast(`${kind}: confirming ${short(sig)}…`);
  const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, "confirmed");
  if (conf.value?.err) throw new Error(JSON.stringify(conf.value.err));
  logTx({ kind, sig, status: "confirmed", t: Date.now() });
  toast(`${kind} confirmed · <a href="${EXPLORER}/tx/${sig}" target="_blank">${short(sig)}</a>`, "ok");
  await refreshWallet();
  return sig;
}
async function rpc(method, params = []) {
  const res = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
async function das(method, params) {
  const res = await fetch(DAS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
async function loadHealth() {
  const t0 = performance.now();
  const [health, epoch, processed, finalized, version, votes] = await Promise.all([
    rpc("getHealth").catch(() => "down"),
    rpc("getEpochInfo"),
    rpc("getSlot", [{ commitment: "processed" }]),
    rpc("getSlot", [{ commitment: "finalized" }]),
    rpc("getVersion"),
    rpc("getVoteAccounts", [{ commitment: "confirmed" }]),
  ]);
  const lag = processed - finalized;
  const status = health !== "ok" ? "down" : lag > 150 ? "degraded" : "operational";
  state.health = { status, slot: processed, epoch: epoch.epoch, epochPct: Math.round((epoch.slotIndex / epoch.slotsInEpoch) * 1000) / 10, lag, version: version["solana-core"], validators: votes.current?.length ?? 0, rpcMs: Math.round(performance.now() - t0) };
  $("stat-status").textContent = status;
  $("stat-slot").textContent = processed.toLocaleString();
  $("stat-epoch").textContent = `${epoch.epoch} · ${state.health.epochPct}%`;
  $("stat-rpc").textContent = `${state.health.rpcMs}ms`;
  $("slot-label").textContent = `#${processed.toLocaleString()}`;
  $("health-label").textContent = `${status} · ${state.health.validators} validators · Agave ${state.health.version}`;
  $("health-dot").className = "dot" + (status === "operational" ? "" : status === "degraded" ? " warn" : " bad");
}
async function loadPrice() {
  const json = await fetch(`${COOKIESCAN}/api/price/cook`).then((r) => r.json());
  const usd = json?.data?.price?.usd;
  $("stat-price").textContent = usd != null ? `$${Number(usd).toPrecision(3)}` : "—";
  return usd;
}
async function refreshWallet() {
  renderWalletCard();
  if (!state.address) return;
  const lamports = await connection.getBalance(new PublicKey(state.address), "confirmed");
  $("stat-bal").textContent = rawToUi(lamports, 9);
  const parsed = await connection.getParsedTokenAccountsByOwner(new PublicKey(state.address), { programId: TOKEN_PROGRAM_ID });
  const rows = parsed.value.map((v) => {
    const info = v.account.data.parsed.info;
    const amt = info.tokenAmount;
    return { mint: info.mint, ui: amt.uiAmountString || amt.uiAmount, symbol: TOKENS.find((t) => t.mint === info.mint)?.symbol || short(info.mint) };
  }).filter((t) => Number(t.ui) > 0);
  $("holdings").innerHTML = [`<div class="token"><b>COOK</b><p>${rawToUi(lamports, 9)}</p></div>`, ...rows.map((t) => `<div class="token"><b>${t.symbol}</b><p>${t.ui}</p><p class="mono">${t.mint}</p></div>`)].join("");
}
function renderWalletCard() {
  $("wallet-card").innerHTML = state.address
    ? `<div class="token"><b>${state.walletName} connected</b><p class="mono addr">${state.address}</p><p class="sub">Genesis ${GENESIS}</p></div>`
    : `<div class="token"><b>Not connected</b><p class="mono">Install Nightly, then connect. We will ask it to use Cookie Chain (rpc.cookiescan.io).</p></div>`;
}
function memoIx(text) {
  return new TransactionInstruction({ keys: [], programId: new PublicKey(MEMO), data: Buffer.from(text, "utf8") });
}
async function bakeCrumb() {
  if (!state.address) return toast("Connect Nightly first", "bad");
  const msg = $("crumb-msg").value.trim();
  if (!msg) return toast("Write a memo first", "bad");
  const amt = Number($("crumb-amt").value || 0);
  const lamports = amt > 0 ? uiToRaw(amt, 9) : 1n;
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: new PublicKey(state.address), toPubkey: new PublicKey(JAR), lamports }),
    memoIx(`OVEN|${msg.slice(0, 180)}`),
  );
  try {
    await sendAndConfirm(tx, "Bake crumb");
    $("crumb-msg").value = "";
    await loadCrumbs();
  } catch (e) {
    toast(`Bake failed: ${e.message || e}`, "bad");
  }
}
function extractMemo(tx) {
  if (!tx) return null;
  const ixs = tx.transaction?.message?.instructions || [];
  for (const ix of ixs) {
    const pid = ix.programId?.toString?.() || ix.programId;
    if (ix.program === "spl-memo" || pid === MEMO) {
      if (typeof ix.parsed === "string") return ix.parsed;
      if (ix.parsed?.info?.memo) return ix.parsed.info.memo;
    }
  }
  for (const l of tx.meta?.logMessages || []) {
    const m = l.match(/Memo \(len \d+\): "(.+)"/);
    if (m) return m[1];
  }
  return null;
}
async function loadCrumbs() {
  try {
    const sigs = await connection.getSignaturesForAddress(new PublicKey(JAR), { limit: 25 });
    const txs = await connection.getParsedTransactions(sigs.map((s) => s.signature), { maxSupportedTransactionVersion: 0 });
    const crumbs = [];
    txs.forEach((tx, i) => {
      const memo = extractMemo(tx);
      if (!memo || !memo.startsWith("OVEN|")) return;
      crumbs.push({ sig: sigs[i].signature, memo: memo.slice(5), who: tx?.transaction?.message?.accountKeys?.[0]?.pubkey?.toString?.() || "", time: sigs[i].blockTime });
    });
    $("crumb-list").innerHTML = crumbs.length
      ? crumbs.map((c) => `<div class="crumb"><span class="pill">${c.time ? new Date(c.time * 1000).toLocaleString() : "pending"}</span><p>${escapeHtml(c.memo)}</p><div class="who">${short(c.who)} · <a href="${EXPLORER}/tx/${c.sig}" target="_blank">${short(c.sig)}</a></div></div>`).join("")
      : `<div class="crumb mono">No Oven crumbs yet — be the first to bake.</div>`;
  } catch (e) {
    $("crumb-list").innerHTML = `<div class="crumb mono">${e.message}</div>`;
  }
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]));
}
function fillTokenSelects() {
  const html = TOKENS.map((t) => `<option value="${t.mint}">${t.symbol}</option>`).join("");
  $("mix-from").innerHTML = html;
  $("mix-to").innerHTML = html;
  $("mix-to").value = BCOOK;
}
function tokenByMint(mint) {
  return TOKENS.find((t) => t.mint === mint) || { symbol: short(mint), mint, decimals: 9 };
}
async function getQuote() {
  const inputMint = $("mix-from").value;
  const outputMint = $("mix-to").value;
  if (inputMint === outputMint) return toast("Pick two different tokens", "bad");
  const inMeta = tokenByMint(inputMint);
  const amount = uiToRaw($("mix-amt").value || "0", inMeta.decimals).toString();
  const slippageBps = $("mix-slip").value || "500";
  const q = new URLSearchParams({ inputMint, outputMint, amount, slippageBps, ...(state.address ? { owner: state.address } : {}) });
  const res = await fetch(`${COOKIEBOX}/quote?${q}`);
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  state.lastQuote = { ...body.route, inputMint, outputMint, amount, slippageBps, inMeta };
  const outMeta = tokenByMint(outputMint);
  $("quote-box").innerHTML = `<b>Cookiebox route</b><p>${$("mix-amt").value} ${inMeta.symbol} → ${rawToUi(body.route.netOutAmount || body.route.outAmount, outMeta.decimals)} ${outMeta.symbol}</p><p class="mono">min out ${rawToUi(body.route.minOutAmount, outMeta.decimals)} · impact ${body.route.priceImpactPct ?? "—"}% · ${body.route.segments?.map((s) => s.venue).join(" → ")}</p>`;
  return body.route;
}
async function doSwap() {
  if (!state.address) return toast("Connect Nightly first", "bad");
  try {
    const route = state.lastQuote || (await getQuote());
    toast("Building Cookiebox swap…");
    const res = await fetch(`${COOKIEBOX}/swap-tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputMint: route.inputMint || $("mix-from").value,
        outputMint: route.outputMint || $("mix-to").value,
        amount: route.amount || uiToRaw($("mix-amt").value, tokenByMint($("mix-from").value).decimals).toString(),
        slippageBps: Number(route.slippageBps || $("mix-slip").value || 500),
        owner: state.address,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const built = await res.json();
    const tx = VersionedTransaction.deserialize(Buffer.from(built.transactionBase64, "base64"));
    await sendAndConfirm(tx, "Cookiebox swap", { blockhash: built.blockhash, lastValidBlockHeight: built.lastValidBlockHeight });
  } catch (e) {
    toast(`Swap failed: ${e.message || e}`, "bad");
  }
}
async function loadPools() {
  try {
    const json = await fetch(`${COOKIESCAN}/api/markets`).then((r) => r.json());
    const markets = json.data || json.markets || json;
    $("pool-list").innerHTML = (markets || []).slice(0, 8).map((m) => `<div class="pool"><b>${m.type}</b><p>${m.baseToken?.symbol}/${m.quoteToken?.symbol}</p><p class="mono">TVL $${Number(m.liquidityUsd || 0).toFixed(0)}</p></div>`).join("");
  } catch (e) {
    $("pool-list").innerHTML = `<div class="pool mono">${e.message}</div>`;
  }
}
function decodeStakePool(data) {
  const buf = Buffer.from(data);
  const totalLamports = buf.readBigUInt64LE(258);
  const poolTokenSupply = buf.readBigUInt64LE(266);
  const rate = poolTokenSupply === 0n ? 1 : Number(totalLamports) / Number(poolTokenSupply);
  return { totalLamports, poolTokenSupply, rate };
}
async function loadStakeInfo() {
  const acc = await connection.getAccountInfo(STAKE_POOL, "confirmed");
  if (!acc) throw new Error("stake pool missing");
  const pool = decodeStakePool(acc.data);
  $("stake-info").innerHTML = `<b>rate ${pool.rate.toFixed(6)} COOK / bCOOK</b><p>TVL ${rawToUi(pool.totalLamports, 9)} COOK · supply ${rawToUi(pool.poolTokenSupply, 9)} bCOOK</p><p>deposit fee 0.5% · withdraw fee 2%</p>`;
  return pool;
}
function encodeStakeIx(tag, amount) {
  const b = Buffer.alloc(9);
  b[0] = tag;
  b.writeBigUInt64LE(BigInt(amount), 1);
  return b;
}
async function stakeCook() {
  if (!state.address) return toast("Connect Nightly first", "bad");
  try {
    const owner = new PublicKey(state.address);
    const lamports = uiToRaw($("stake-amt").value || "0", 9);
    if (lamports <= 0n) throw new Error("amount must be > 0");
    const destAta = getAssociatedTokenAddressSync(BCOOK_PK, owner, true, TOKEN_PROGRAM_ID);
    const ephemeral = Keypair.generate();
    const depositIx = new TransactionInstruction({
      programId: STAKE_POOL_PROGRAM,
      data: encodeStakeIx(14, lamports),
      keys: [
        { pubkey: STAKE_POOL, isSigner: false, isWritable: true },
        { pubkey: WITHDRAW_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: RESERVE_STAKE, isSigner: false, isWritable: true },
        { pubkey: ephemeral.publicKey, isSigner: true, isWritable: true },
        { pubkey: destAta, isSigner: false, isWritable: true },
        { pubkey: MANAGER_FEE, isSigner: false, isWritable: true },
        { pubkey: destAta, isSigner: false, isWritable: true },
        { pubkey: BCOOK_PK, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
    });
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: owner, toPubkey: ephemeral.publicKey, lamports }),
      createAssociatedTokenAccountIdempotentInstruction(owner, destAta, owner, BCOOK_PK),
      depositIx,
    );
    tx.feePayer = owner;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    tx.partialSign(ephemeral);
    await sendAndConfirm(tx, "Stake COOK");
  } catch (e) {
    toast(`Stake failed: ${e.message || e}`, "bad");
  }
}
async function unstakeBcook() {
  if (!state.address) return toast("Connect Nightly first", "bad");
  try {
    const owner = new PublicKey(state.address);
    const poolTokens = uiToRaw($("stake-amt").value || "0", 9);
    if (poolTokens <= 0n) throw new Error("amount must be > 0");
    const sourceAta = getAssociatedTokenAddressSync(BCOOK_PK, owner, true, TOKEN_PROGRAM_ID);
    const transferAuthority = Keypair.generate();
    const withdrawIx = new TransactionInstruction({
      programId: STAKE_POOL_PROGRAM,
      data: encodeStakeIx(16, poolTokens),
      keys: [
        { pubkey: STAKE_POOL, isSigner: false, isWritable: true },
        { pubkey: WITHDRAW_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: transferAuthority.publicKey, isSigner: true, isWritable: false },
        { pubkey: sourceAta, isSigner: false, isWritable: true },
        { pubkey: RESERVE_STAKE, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: true },
        { pubkey: MANAGER_FEE, isSigner: false, isWritable: true },
        { pubkey: BCOOK_PK, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
    });
    const tx = new Transaction().add(createApproveInstruction(sourceAta, transferAuthority.publicKey, owner, poolTokens), withdrawIx);
    tx.feePayer = owner;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    tx.partialSign(transferAuthority);
    await sendAndConfirm(tx, "Unstake bCOOK");
  } catch (e) {
    toast(`Unstake failed: ${e.message || e}`, "bad");
  }
}
async function tokenRegistry() {
  if (state.tokens) return state.tokens;
  const json = await fetch(`${COOKIESCAN}/api/tokens`).then((r) => r.json());
  state.tokens = json.data || json.tokens || json;
  return state.tokens;
}
function searchRegistry(tokens, query, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (t) => {
    const sym = (t.metadata?.symbol || "").toLowerCase();
    const name = (t.metadata?.name || "").toLowerCase();
    const mint = (t.mint || "").toLowerCase();
    if (mint === q) return 100;
    if (sym === q) return 95;
    if (name === q) return 90;
    if (sym.startsWith(q)) return 70;
    if (name.startsWith(q)) return 60;
    if (mint.startsWith(q)) return 55;
    if (sym.includes(q) || name.includes(q)) return 35;
    return 0;
  };
  return tokens.map((t) => ({ t, s: score(t) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || (b.t.marketData?.liquidity || 0) - (a.t.marketData?.liquidity || 0)).slice(0, limit).map((x) => x.t);
}
async function runSearch() {
  const q = $("scan-q").value.trim();
  if (!q) return;
  const hits = searchRegistry(await tokenRegistry(), q);
  $("scan-out").innerHTML = hits.length
    ? hits.map((t) => {
        const usd = t.price?.usd != null ? `$${Number(t.price.usd).toPrecision(3)}` : "—";
        return `<div class="token"><b>${t.metadata?.symbol || "?"} · ${t.metadata?.name || ""}</b><p>${usd} · liq ${Number(t.marketData?.liquidity || 0).toFixed(0)} COOK · ${t.marketData?.holderCount || 0} holders</p><p class="mono"><a href="${EXPLORER}/token/${t.mint}" target="_blank">${t.mint}</a></p></div>`;
      }).join("")
    : `<div class="token mono">no matches</div>`;
}
async function loadDas() {
  if (!state.address) return toast("Connect Nightly first", "bad");
  const result = await das("getAssetsByOwner", { ownerAddress: state.address, page: 1, limit: 20 });
  const items = result.items || [];
  $("scan-out").innerHTML = items.length
    ? items.map((a) => {
        const md = a.content?.metadata || {};
        return `<div class="token"><b>${md.name || a.id}</b><p>${md.symbol || a.interface}</p><p class="mono">${a.id}</p></div>`;
      }).join("")
    : `<div class="token mono">No DAS assets indexed for this wallet yet.</div>`;
}
function chefSay(html, who = "chef") {
  const el = document.createElement("div");
  el.className = `msg ${who}`;
  el.innerHTML = html;
  $("chat").appendChild(el);
  $("chat").scrollTop = $("chat").scrollHeight;
}
function resolveMint(name) {
  const n = name.toLowerCase();
  if (n === "cook" || n === "wcook") return TOKENS[0];
  if (n === "bcook" || n === "bakedcook") return TOKENS[1];
  if (n === "cookhouse") return TOKENS[2];
  return TOKENS.find((t) => t.symbol.toLowerCase() === n) || null;
}
async function chefAnswer(q) {
  chefSay(escapeHtml(q), "user");
  const s = q.toLowerCase();
  try {
    if (/health|status|lag|epoch|validator|rpc/.test(s)) {
      await loadHealth();
      const h = state.health;
      chefSay(`<b>chain_health</b><div class="tool">${h.status}\nslot ${h.slot}\nepoch ${h.epoch} (${h.epochPct}%)\nfinalization lag ${h.lag}\nvalidators ${h.validators}\nrpc ${h.rpcMs}ms\ncore ${h.version}</div>`);
      return;
    }
    if (/bridge/.test(s)) {
      chefSay(`Bridge COOK 1:1 through <a href="https://hyperlane.cookiescan.io" target="_blank">hyperlane.cookiescan.io</a>. Solana mint is <span class="mono">36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1</span>.`);
      return;
    }
    if (/pool/.test(s)) {
      const json = await fetch(`${COOKIESCAN}/api/markets`).then((r) => r.json());
      const markets = (json.data || json.markets || []).slice(0, 6);
      chefSay(`<b>get_pools</b><div class="tool">${markets.map((m) => `${m.type} ${m.baseToken?.symbol}/${m.quoteToken?.symbol}  $${Number(m.liquidityUsd || 0).toFixed(0)}`).join("\n")}</div>`);
      return;
    }
    if (/stake|apy|bcook/.test(s) && !/quote|swap/.test(s)) {
      const pool = await loadStakeInfo();
      chefSay(`<b>stake_info</b><div class="tool">rate ${pool.rate.toFixed(6)} COOK per bCOOK\nTVL ${rawToUi(pool.totalLamports, 9)} COOK\nfees 0.5% deposit / 2% withdraw\nmint ${BCOOK}</div>`);
      return;
    }
    if (/balance|wallet|holding/.test(s)) {
      if (!state.address) return chefSay("Connect Nightly and I will read your Cookie Chain balances.");
      await refreshWallet();
      chefSay(`<b>get_balance</b><div class="tool">${state.address}\nnative COOK ${$("stat-bal").textContent}</div>`);
      return;
    }
    if (/nft|das/.test(s)) {
      if (!state.address) return chefSay("Connect Nightly to load DAS assets.");
      const result = await das("getAssetsByOwner", { ownerAddress: state.address, page: 1, limit: 8 });
      chefSay(`<b>get_wallet_nfts</b><div class="tool">${(result.items || []).map((a) => a.content?.metadata?.name || a.id).join("\n") || "none indexed"}</div>`);
      return;
    }
    const qm = q.match(/(?:quote|swap)\s+([\d.]+)\s*([a-z0-9]+)\s+(?:to|for|into|->)\s*([a-z0-9]+)/i) || q.match(/([\d.]+)\s*(cook)\s+(?:to|for)\s*(bcook|cookhouse)/i);
    if (qm) {
      const from = resolveMint(qm[2]);
      const to = resolveMint(qm[3]);
      if (!from || !to) return chefSay("I know COOK, bCOOK, and COOKHOUSE by ticker. Search Cookiescan for other mints.");
      $("mix-from").value = from.mint;
      $("mix-to").value = to.mint;
      $("mix-amt").value = qm[1];
      const route = await getQuote();
      chefSay(`<b>get_quote · cookiebox</b><div class="tool">${qm[1]} ${from.symbol} → ${rawToUi(route.netOutAmount || route.outAmount, to.decimals)} ${to.symbol}\nmin ${rawToUi(route.minOutAmount, to.decimals)}\nvia ${(route.segments || []).map((x) => x.venue).join(" → ")}</div>Open Mix and hit Swap to sign with Nightly.`);
      return;
    }
    const tokens = await tokenRegistry();
    const query = q.replace(/search|find|show|token|the|for/gi, " ").trim() || q;
    const hits = searchRegistry(tokens, query, 5);
    if (hits.length) {
      chefSay(`<b>search_tokens</b><div class="tool">${hits.map((t) => `${t.metadata?.symbol}  ${t.mint}  $${t.price?.usd ?? "—"}`).join("\n")}</div>`);
      return;
    }
    chefSay(`I can check chain health, quote COOK/bCOOK/COOKHOUSE, search Cookiescan tokens, list pools, read stake info, balances, DAS NFTs, and point you at the Hyperlane bridge.`);
  } catch (e) {
    chefSay(`Tool failed: ${escapeHtml(e.message || String(e))}`);
  }
}
function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  ["kitchen", "bake", "mix", "stake", "scan", "chef", "bridge"].forEach((id) => $("panel-" + id).classList.toggle("hidden", id !== name));
}
async function boot() {
  fillTokenSelects();
  renderTxLog();
  renderWalletCard();
  $("tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (tab) showTab(tab.dataset.tab);
  });
  $("connect-btn").addEventListener("click", async () => {
    try {
      if (state.address) await disconnectWallet();
      else await connectWallet();
    } catch (e) {
      toast(`Wallet: ${e.message || e}`, "bad");
    }
  });
  $("switch-network").addEventListener("click", async () => {
    try {
      await ensureCookieNetwork();
      toast("Asked Nightly to use Cookie Chain genesis + RPC", "ok");
    } catch (e) {
      toast(String(e.message || e), "bad");
    }
  });
  $("bake-btn").addEventListener("click", bakeCrumb);
  $("quote-btn").addEventListener("click", () => getQuote().catch((e) => toast(e.message, "bad")));
  $("swap-btn").addEventListener("click", doSwap);
  $("stake-btn").addEventListener("click", stakeCook);
  $("unstake-btn").addEventListener("click", unstakeBcook);
  $("scan-btn").addEventListener("click", () => runSearch().catch((e) => toast(e.message, "bad")));
  $("das-btn").addEventListener("click", () => loadDas().catch((e) => toast(e.message, "bad")));
  $("chef-btn").addEventListener("click", () => {
    const q = $("chef-q").value.trim();
    if (q) {
      $("chef-q").value = "";
      chefAnswer(q);
    }
  });
  $("chef-q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("chef-btn").click();
  });
  document.querySelectorAll("[data-prompt]").forEach((b) => b.addEventListener("click", () => chefAnswer(b.dataset.prompt)));
  chefSay("Oven is hot. Ask for health, a COOK→bCOOK quote, COOKHOUSE, pools, or the bridge.");
  await Promise.all([loadHealth(), loadPrice(), loadCrumbs(), loadPools(), loadStakeInfo().catch(() => {})]);
  setInterval(() => loadHealth().catch(() => {}), 12000);
}
boot().catch((e) => toast(e.message || String(e), "bad"));
