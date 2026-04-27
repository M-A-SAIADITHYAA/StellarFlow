/*
  main.js — StellarFlow application
  Vanilla JS, no framework. Manages state, renders UI, handles events.
*/

import './style.css';
import { icons } from './icons.js';
import {
  checkFreighter,
  connectWallet,
  fetchBalance,
  fetchTransactions,
  sendPayment,
  fundWithFriendbot,
  shortenAddress,
  formatXLM,
  timeAgo,
  getStellarExpertUrl,
} from './stellar.js';

// ── Application State ──

const state = {
  connected: false,
  publicKey: null,
  balance: null,
  transactions: [],
  loading: {
    connect: false,
    balance: false,
    transactions: false,
    send: false,
    fund: false,
  },
  sendForm: {
    destination: '',
    amount: '',
  },
  txResult: null,     // { type: 'success'|'fail', message, hash? }
  errors: {},
};

const app = document.getElementById('app');

// ── Render pipeline ──

function render() {
  app.innerHTML = renderHeader() + renderMain();
  attachListeners();
}

// ── Header ──

function renderHeader() {
  return `
    <header class="header" id="header">
      <a class="logo" href="/" id="logo-link">
        <div class="logo-icon">
          ${icons.hexagon}
        </div>
        <div class="logo-text">StellarFlow <span>testnet</span></div>
      </a>
      <div class="header-right">
        <div class="network-badge">Testnet</div>
        ${state.connected ? `
          <button class="btn btn-ghost" id="btn-refresh" title="Refresh">
            ${icons.refresh}
          </button>
          <button class="btn btn-danger" id="btn-disconnect">
            ${icons.disconnect}
            <span>Disconnect</span>
          </button>
        ` : ''}
      </div>
    </header>
  `;
}

// ── Main content switch ──

function renderMain() {
  if (!state.connected) {
    return `<main class="main">${renderWelcome()}</main>`;
  }
  return `<main class="main"><div class="dashboard">${renderBalanceCard()}${renderSendCard()}${renderHistoryCard()}</div></main>`;
}

// ── Welcome / connect screen ──

function renderWelcome() {
  return `
    <section class="welcome" id="welcome-section">
      <div class="welcome-icon">
        ${icons.wallet}
      </div>
      <h1>Connect Your Wallet</h1>
      <p>
        Link your Freighter wallet to view your XLM balance,
        send transactions, and browse your history on the Stellar testnet.
      </p>
      <button class="btn btn-primary btn-lg" id="btn-connect" ${state.loading.connect ? 'disabled' : ''}>
        ${state.loading.connect ? '<span class="spinner"></span> Connecting…' : `${icons.wallet} Connect Freighter`}
      </button>
      <p class="freighter-note">
        Don't have Freighter?
        <a href="https://www.freighter.app/" target="_blank" rel="noopener">Download it here</a>
      </p>
      ${state.errors.connect ? `<p class="form-error" style="margin-top: var(--space-4)">${state.errors.connect}</p>` : ''}
    </section>
  `;
}

// ── Balance card ──

function renderBalanceCard() {
  const displayBalance = state.loading.balance
    ? '<span class="skeleton" style="display:inline-block;width:140px;height:36px"></span>'
    : formatXLM(state.balance);

  return `
    <section class="card" id="balance-card">
      <div class="card-header">
        <h2 class="card-title">Wallet Balance</h2>
      </div>
      <div class="card-body">
        <div class="balance-row">
          <div class="balance-info">
            <div class="balance-amount" id="balance-display">
              ${displayBalance}<span class="currency">XLM</span>
            </div>
            <div class="balance-address" id="copy-address" title="Click to copy full address">
              ${shortenAddress(state.publicKey)}
              ${icons.copy}
            </div>
          </div>
          <div class="balance-actions">
            <button class="btn fund-btn" id="btn-fund" ${state.loading.fund ? 'disabled' : ''}>
              ${state.loading.fund ? '<span class="spinner"></span>' : icons.zap}
              ${state.loading.fund ? 'Funding…' : 'Fund via Friendbot'}
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

// ── Send card ──

function renderSendCard() {
  return `
    <section class="card" id="send-card">
      <div class="card-header">
        <h2 class="card-title">Send XLM</h2>
      </div>
      <div class="card-body">
        ${state.txResult ? renderTxResult() : ''}
        <form class="send-form" id="send-form">
          <div class="form-group">
            <label class="form-label" for="input-destination">Recipient Address</label>
            <input
              class="form-input mono ${state.errors.destination ? 'error' : ''}"
              type="text"
              id="input-destination"
              placeholder="G... (Stellar public key)"
              value="${state.sendForm.destination}"
              autocomplete="off"
              spellcheck="false"
            />
            ${state.errors.destination ? `<p class="form-error">${state.errors.destination}</p>` : ''}
          </div>
          <div class="form-group">
            <label class="form-label" for="input-amount">Amount (XLM)</label>
            <input
              class="form-input ${state.errors.amount ? 'error' : ''}"
              type="text"
              inputmode="decimal"
              id="input-amount"
              placeholder="0.00"
              value="${state.sendForm.amount}"
              autocomplete="off"
            />
            ${state.errors.amount ? `<p class="form-error">${state.errors.amount}</p>` : ''}
            <p class="form-hint">Minimum 0.0000001 XLM. A base fee of 0.00001 XLM applies.</p>
          </div>
          <div class="send-form-actions">
            <button class="btn btn-primary btn-lg" type="submit" id="btn-send" ${state.loading.send ? 'disabled' : ''}>
              ${state.loading.send ? '<span class="spinner"></span> Sending…' : `${icons.send} Send Transaction`}
            </button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderTxResult() {
  const isSuccess = state.txResult.type === 'success';
  return `
    <div class="tx-result ${isSuccess ? 'success' : 'fail'}" id="tx-result">
      <div class="tx-result-icon">${isSuccess ? icons.check : icons.x}</div>
      <div class="tx-result-body">
        <div class="tx-result-title">${state.txResult.message}</div>
        ${state.txResult.hash ? `
          <div class="tx-result-hash">
            <a href="${getStellarExpertUrl(state.txResult.hash)}" target="_blank" rel="noopener">
              ${state.txResult.hash}
            </a>
          </div>
        ` : ''}
      </div>
      <button class="btn btn-ghost" id="dismiss-result" title="Dismiss">${icons.x}</button>
    </div>
  `;
}

// ── Transaction history card ──

function renderHistoryCard() {
  let body = '';

  if (state.loading.transactions) {
    body = Array.from({ length: 4 })
      .map(
        () => `
        <div class="tx-item">
          <div class="skeleton" style="width:36px;height:36px;border-radius:10px;flex-shrink:0"></div>
          <div class="tx-details" style="flex:1">
            <div class="skeleton" style="width:120px;height:14px;margin-bottom:6px"></div>
            <div class="skeleton" style="width:80px;height:10px"></div>
          </div>
          <div class="skeleton" style="width:70px;height:16px"></div>
        </div>
      `
      )
      .join('');
  } else if (state.transactions.length === 0) {
    body = `
      <div class="empty-state">
        ${icons.activity}
        <p>No transactions yet.<br/>Send XLM or fund your account to get started.</p>
      </div>
    `;
  } else {
    body = state.transactions.map((tx) => renderTxItem(tx)).join('');
  }

  return `
    <section class="card" id="history-card">
      <div class="card-header">
        <h2 class="card-title">Recent Transactions</h2>
        ${!state.loading.transactions ? `
          <button class="btn btn-ghost" id="btn-refresh-history" title="Refresh history">
            ${icons.refresh}
          </button>
        ` : ''}
      </div>
      <div class="tx-list" id="tx-list">
        ${body}
      </div>
    </section>
  `;
}

function renderTxItem(tx) {
  const op = tx.operations[0];
  let direction = 'other';
  let label = 'Transaction';
  let amountStr = '';

  if (op) {
    if (op.type === 'payment') {
      if (op.from === state.publicKey) {
        direction = 'sent';
        label = `Sent to ${shortenAddress(op.to)}`;
        amountStr = `−${formatXLM(op.amount)}`;
      } else {
        direction = 'received';
        label = `Received from ${shortenAddress(op.from)}`;
        amountStr = `+${formatXLM(op.amount)}`;
      }
    } else if (op.type === 'create_account') {
      if (op.funder === state.publicKey) {
        direction = 'sent';
        label = `Created ${shortenAddress(op.account)}`;
        amountStr = `−${formatXLM(op.starting_balance)}`;
      } else {
        direction = 'received';
        label = 'Account funded';
        amountStr = `+${formatXLM(op.starting_balance)}`;
      }
    } else {
      label = op.type.replace(/_/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
  }

  const directionIcon =
    direction === 'sent'
      ? icons.arrowUpRight
      : direction === 'received'
      ? icons.arrowDownLeft
      : icons.activity;

  return `
    <div class="tx-item">
      <div class="tx-direction ${direction}">
        ${directionIcon}
      </div>
      <div class="tx-details">
        <div class="tx-type">${label}</div>
        <div class="tx-meta">
          <span class="tx-time">${timeAgo(tx.created_at)}</span>
          <span style="color:var(--text-tertiary)">·</span>
          <a class="tx-hash-link" href="${getStellarExpertUrl(tx.hash)}" target="_blank" rel="noopener" title="${tx.hash}">
            ${tx.hash.slice(0, 8)}…
          </a>
        </div>
      </div>
      ${amountStr ? `
        <div class="tx-amount ${direction}">
          ${amountStr}<span class="unit">XLM</span>
        </div>
      ` : ''}
    </div>
  `;
}

// ── Event listeners ──

function attachListeners() {
  // Connect
  const btnConnect = document.getElementById('btn-connect');
  if (btnConnect) {
    btnConnect.addEventListener('click', handleConnect);
  }

  // Disconnect
  const btnDisconnect = document.getElementById('btn-disconnect');
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', handleDisconnect);
  }

  // Refresh all
  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => refreshData());
  }

  // Refresh history only
  const btnRefreshHistory = document.getElementById('btn-refresh-history');
  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', () => loadTransactions());
  }

  // Copy address
  const copyAddr = document.getElementById('copy-address');
  if (copyAddr) {
    copyAddr.addEventListener('click', handleCopyAddress);
  }

  // Fund
  const btnFund = document.getElementById('btn-fund');
  if (btnFund) {
    btnFund.addEventListener('click', handleFund);
  }

  // Send form
  const sendForm = document.getElementById('send-form');
  if (sendForm) {
    sendForm.addEventListener('submit', handleSend);
  }

  // Preserve form values while typing
  const inputDest = document.getElementById('input-destination');
  if (inputDest) {
    inputDest.addEventListener('input', (e) => {
      state.sendForm.destination = e.target.value;
      state.errors.destination = '';
    });
  }

  const inputAmt = document.getElementById('input-amount');
  if (inputAmt) {
    inputAmt.addEventListener('input', (e) => {
      state.sendForm.amount = e.target.value;
      state.errors.amount = '';
    });
  }

  // Dismiss tx result
  const dismissBtn = document.getElementById('dismiss-result');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      state.txResult = null;
      render();
    });
  }

  // Logo link — prevent page reload
  const logoLink = document.getElementById('logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => e.preventDefault());
  }
}

// ── Handlers ──

async function handleConnect() {
  state.loading.connect = true;
  state.errors.connect = '';
  render();

  try {
    const pubKey = await connectWallet();
    state.publicKey = pubKey;
    state.connected = true;
    state.loading.connect = false;
    render();
    refreshData();
  } catch (err) {
    state.loading.connect = false;
    state.errors.connect = err.message || 'Failed to connect wallet.';
    render();
  }
}

function handleDisconnect() {
  state.connected = false;
  state.publicKey = null;
  state.balance = null;
  state.transactions = [];
  state.txResult = null;
  state.sendForm = { destination: '', amount: '' };
  state.errors = {};
  render();
}

async function handleCopyAddress() {
  if (!state.publicKey) return;
  try {
    await navigator.clipboard.writeText(state.publicKey);
    showCopyTooltip('Address copied!');
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = state.publicKey;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showCopyTooltip('Address copied!');
  }
}

async function handleFund() {
  state.loading.fund = true;
  render();

  try {
    await fundWithFriendbot(state.publicKey);
    state.loading.fund = false;
    showCopyTooltip('Account funded with 10,000 XLM!');
    refreshData();
  } catch (err) {
    state.loading.fund = false;
    showCopyTooltip(err.message || 'Funding failed');
    render();
  }
}

async function handleSend(e) {
  e.preventDefault();

  // Validate
  state.errors = {};
  let hasError = false;

  if (!state.sendForm.destination.trim()) {
    state.errors.destination = 'Recipient address is required.';
    hasError = true;
  }
  if (!state.sendForm.amount.trim()) {
    state.errors.amount = 'Amount is required.';
    hasError = true;
  } else if (parseFloat(state.sendForm.amount) <= 0) {
    state.errors.amount = 'Amount must be greater than zero.';
    hasError = true;
  }

  if (hasError) {
    render();
    return;
  }

  state.loading.send = true;
  state.txResult = null;
  render();

  try {
    const result = await sendPayment(
      state.publicKey,
      state.sendForm.destination.trim(),
      state.sendForm.amount.trim()
    );

    state.txResult = {
      type: 'success',
      message: 'Transaction submitted successfully!',
      hash: result.hash,
    };
    state.sendForm = { destination: '', amount: '' };
    state.loading.send = false;
    render();

    // Refresh balance and history
    loadBalance();
    loadTransactions();
  } catch (err) {
    state.txResult = {
      type: 'fail',
      message: err.message || 'Transaction failed. Please try again.',
    };
    state.loading.send = false;
    render();
  }
}

// ── Data loaders ──

async function refreshData() {
  loadBalance();
  loadTransactions();
}

async function loadBalance() {
  state.loading.balance = true;
  render();

  try {
    const bal = await fetchBalance(state.publicKey);
    state.balance = bal;
  } catch {
    state.balance = '0';
  }
  state.loading.balance = false;
  render();
}

async function loadTransactions() {
  state.loading.transactions = true;
  render();

  try {
    const txs = await fetchTransactions(state.publicKey, 15);
    state.transactions = txs;
  } catch {
    state.transactions = [];
  }
  state.loading.transactions = false;
  render();
}

// ── Copy tooltip ──

let tooltipTimeout;
function showCopyTooltip(text) {
  let tooltip = document.querySelector('.copy-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'copy-tooltip';
    document.body.appendChild(tooltip);
  }
  tooltip.textContent = text;
  tooltip.classList.add('show');

  clearTimeout(tooltipTimeout);
  tooltipTimeout = setTimeout(() => {
    tooltip.classList.remove('show');
  }, 2200);
}

// ── Boot ──

render();
