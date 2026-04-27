/*
  stellar.js — Wrapper around Stellar SDK + Freighter API
  Handles wallet connection, balance fetching, transaction building, and history.
*/

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  isConnected,
  requestAccess,
  signTransaction,
  getNetwork,
} from '@stellar/freighter-api';

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

const server = new StellarSdk.Horizon.Server(HORIZON_TESTNET);

// ── Wallet helpers ──

export async function checkFreighter() {
  try {
    const result = await isConnected();
    return result.isConnected === true;
  } catch {
    return false;
  }
}

export async function connectWallet() {
  const hasFreighter = await checkFreighter();
  if (!hasFreighter) {
    throw new Error(
      'Freighter wallet not found. Please install the Freighter browser extension.'
    );
  }

  const accessObj = await requestAccess();
  if (accessObj.error) {
    throw new Error(accessObj.error);
  }
  return accessObj.address;
}

// ── Account & Balance ──

export async function fetchBalance(publicKey) {
  const account = await server.loadAccount(publicKey);
  const nativeBalance = account.balances.find(
    (b) => b.asset_type === 'native'
  );
  return nativeBalance ? nativeBalance.balance : '0';
}

export async function fundWithFriendbot(publicKey) {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // Friendbot returns 400 if already funded
    if (body?.detail?.includes('createAccountAlreadyExist')) {
      throw new Error('Account is already funded on testnet.');
    }
    throw new Error('Friendbot funding failed. Try again in a moment.');
  }
  return response.json();
}

// ── Send transaction ──

export async function sendPayment(senderPublicKey, destination, amount) {
  // Validate address
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error('Invalid Stellar address. Check the recipient and try again.');
  }

  // Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Amount must be a positive number.');
  }

  // Load sender account (for sequence number)
  const senderAccount = await server.loadAccount(senderPublicKey);

  // Build the transaction
  const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset: StellarSdk.Asset.native(),
        amount: parsedAmount.toFixed(7),
      })
    )
    .setTimeout(30)
    .build();

  // Sign with Freighter
  const xdr = transaction.toXDR();
  const signResult = await signTransaction(xdr, {
    network: 'TESTNET',
    networkPassphrase: NETWORK_PASSPHRASE,
    address: senderPublicKey,
  });

  if (signResult.error) {
    throw new Error(signResult.error);
  }

  // Submit
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signResult.signedTxXdr,
    NETWORK_PASSPHRASE
  );
  const result = await server.submitTransaction(signedTx);
  return result;
}

// ── Transaction history ──

export async function fetchTransactions(publicKey, limit = 15) {
  const txPage = await server
    .transactions()
    .forAccount(publicKey)
    .limit(limit)
    .order('desc')
    .call();

  // Enrich with operations so we can show amounts
  const enriched = await Promise.all(
    txPage.records.map(async (tx) => {
      try {
        const opsPage = await tx.operations();
        return {
          id: tx.id,
          hash: tx.hash,
          created_at: tx.created_at,
          fee_charged: tx.fee_charged,
          successful: tx.successful,
          memo: tx.memo,
          source_account: tx.source_account,
          operations: opsPage.records,
        };
      } catch {
        return {
          id: tx.id,
          hash: tx.hash,
          created_at: tx.created_at,
          fee_charged: tx.fee_charged,
          successful: tx.successful,
          memo: tx.memo,
          source_account: tx.source_account,
          operations: [],
        };
      }
    })
  );

  return enriched;
}

// ── Helpers ──

export function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function formatXLM(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0.00';
  // Show up to 4 decimal places, trim trailing zeros
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function getStellarExpertUrl(hash) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
