import EthCrypto from 'eth-crypto';
import { hashMessage, id as hashId } from '@ethersproject/hash';
import Common from '@ethereumjs/common';
import { Transaction as EthJSTx, TxOptions as EthJSTxOpts } from '@ethereumjs/tx';
import { PromiEvent, TransactionReceipt as ITxReceipt } from 'web3-core';
import Web3Utils from 'web3-utils';
import Web3 from 'web3';

import Big from './types/big';
import ITx from './types/ITx';
import IProviderGroup from './types/IProviderGroup';
import ProviderGroup from './ProviderGroup';

interface ITxHex {
  nonce: string;
  gasPrice: string;
  gasLimit: string;
  to: string;
  value?: string;
  data?: string;
}

export default class Wallet {
  private readonly provider: IProviderGroup;

  public readonly address: string;

  private readonly privateKey: string;

  private opts: EthJSTxOpts | undefined;

  protected gasPrices: { [key: number]: Big };

  /**
   * Constructs a new Wallet instance
   *
   * @param provider the provider(s) to use for transactions
   * @param address the address (0x prefix included)
   * @param privateKey the private key (0x prefix removed)
   */
  constructor(provider: IProviderGroup | Web3, address: string, privateKey: string) {
    this.provider = provider instanceof Web3 ? new ProviderGroup(provider) : provider;
    this.address = address;
    this.privateKey = privateKey;

    // Nothing is ever deleted from gasPrices. If this code were
    // to run forever, this would cause memory to grow forever (very slowly).
    this.gasPrices = {};
  }

  /**
   * Initializes wallet such that it has correct chain/hardfork parameters
   * when sending transactions
   *
   * @param opts (optional) parameters copied from another wallet
   */
  async init(opts: EthJSTxOpts | undefined = undefined): Promise<void> {
    if (opts !== undefined) {
      this.opts = opts;
      return;
    }

    const chainID = await this.provider.eth.getChainId();
    switch (chainID) {
      case 1337: // ganache
      case 1:
        this.opts = {
          common: new Common({ chain: 'mainnet', hardfork: 'petersburg' }),
        };
        break;
      case 3:
        this.opts = {
          common: new Common({ chain: 'ropsten', hardfork: 'petersburg' }),
        };
        break;
      default:
        throw new Error(`Chain ID ${chainID} unknown`);
    }
  }

  public get label(): string {
    return this.address.slice(0, 6);
  }

  public get emptyTx(): ITx {
    return {
      gasPrice: Big('0'),
      gasLimit: Big('21000'),
      to: this.address,
      value: Web3Utils.toHex('0'),
      data: undefined,
    };
  }

  /**
   * Gets the minimum gas price necessary to submit or replace a transaction.
   *
   * CAUTION: If a transaction was submitted by means other than this Wallet
   * code, the returned number could be inaccurate.
   *
   * @param nonce the transaction's nonce, as an integer (base 10)
   * @returns smallest gas price that would allow the nonce into the mempool
   */
  public minGasPriceFor(nonce: number): Big {
    return nonce in this.gasPrices ? this.gasPrices[nonce].times(1.12) : Big(0);
  }

  /**
   * Estimates the gas necessary to send a given transaction
   *
   * @param tx an object describing the transaction. See `signAndSend`
   * @returns estimated amount of gas that the tx will require
   *
   */
  public estimateGas(tx: ITx, nonce = 0): Promise<number> {
    return this.provider.eth.estimateGas({
      from: this.address,
      to: tx.to,
      value: tx.value,
      gasPrice: Web3Utils.toHex(tx.gasPrice.toFixed(0)),
      data: tx.data,
      nonce,
    });
  }

  /**
   * Signs and sends a transaction
   *
   * @param tx an object describing the transaction
   * @param nonce the transaction's nonce, as an integer (base 10)
   * @param mainConnectionIdx index of the connection for which a PromiEvent should be returned. Indices are
   *    based on order of construction args
   * @param useAllConnections whether to send via all connections, or just the main one
   * @returns See [here](https://web3js.readthedocs.io/en/v1.2.0/callbacks-promises-events.html#promievent)
   *
   * @example
   * // Send the following tx with nonce 0
   * const tx = {
   *  gasPrice: Big("21000000000"),
   *  gasLimit: Big("3000000"),
   *  to: '0x0000...',
   *  value: '0x00',
   *  data: '0x7f74657374320...',
   * };
   * const sentTx = wallet.signAndSend(tx, 0);
   */
  public signAndSend(tx: ITx, nonce: number, mainConnectionIdx = 0, useAllConnections = true): PromiEvent<ITxReceipt> {
    if ('gasPrice' in tx) this.gasPrices[nonce] = tx.gasPrice;
    return this.send(this.sign(Wallet.parse(tx, nonce)), mainConnectionIdx, useAllConnections);
  }

  /**
   * Signs a transaction with the wallet's private key
   *
   * @param tx an object describing the transaction to sign
   * @returns the serialized signed transaction
   *
   * @example
   * const tx = {
   *  nonce: '0x00',
   *  gasPrice: '0x09184e72a000',
   *  gasLimit: '0x113992',
   *  to: '0x0000...',
   *  value: '0x00',
   *  data: '0x7f74657374320...',
   * };
   * const signedTx = wallet._sign(tx);
   */
  private sign(txHex: ITxHex): string {
    // txHex.from is automatically determined from private key
    const tx = EthJSTx.fromTxData(txHex, this.opts);
    const privateKey = Buffer.from(this.privateKey, 'hex');
    return `0x${tx.sign(privateKey).serialize().toString('hex')}`;
  }

  /**
   * Sends a signed transaction
   *
   * @param signedTx a transaction that's been signed by this wallet
   * @param mainConnectionIdx index of the connection for which a PromiEvent should be returned. Indices are
   *    based on order of construction args
   * @param useAllConnections whether to send via all connections, or just the main one
   * @returns See [here](https://web3js.readthedocs.io/en/v1.2.0/callbacks-promises-events.html#promievent)
   */
  private send(signedTx: string, mainConnectionIdx = 0, useAllConnections = true): PromiEvent<ITxReceipt> {
    return this.provider.eth.dispatchSignedTransaction(signedTx, mainConnectionIdx, useAllConnections);
  }

  public simulateMEVBundle(
    txs: (string | ITx)[],
    nonces: number[],
    connectionIdx: number,
    blockNumber: number,
    blockTimestamp: number,
  ): Promise<any> {
    const signedTxs = txs.map((tx, i) => {
      if (typeof tx === 'string') return tx;
      return this.sign(Wallet.parse(tx, nonces[i]));
    });

    const signer = (request: string): string => {
      const message = hashMessage(hashId(request));
      return `${this.address}:${EthCrypto.sign(this.privateKey, message)}`;
    };

    // @ts-expect-error: Custom Web3 provider
    this.provider.eth.providers[connectionIdx]._provider._signer = signer;
    // @ts-expect-error: Custom Web3 extension
    return this.provider.eth.providers[connectionIdx].eth.simulateBundle(
      signedTxs,
      `0x${blockNumber.toString(16)}`,
      `0x${(blockNumber - 1).toString(16)}`,
      Math.floor(blockTimestamp),
    );
  }

  public signAndSendMEVBundle(
    txs: (string | ITx)[],
    nonces: number[],
    connectionIdx: number,
    targetBlock: number,
  ): PromiEvent<any> {
    const signedTxs = txs.map((tx, i) => {
      if (typeof tx === 'string') return tx;
      return this.sign(Wallet.parse(tx, nonces[i]));
    });
    return this.sendMEVBundle(signedTxs, connectionIdx, targetBlock);
  }

  private sendMEVBundle(signedTxs: string[], connectionIdx: number, targetBlock: number): PromiEvent<any> {
    const params = [signedTxs, `0x${targetBlock.toString(16)}`, 0, 0];
    const signer = (request: string): string => {
      const message = hashMessage(hashId(request));
      return `${this.address}:${EthCrypto.sign(this.privateKey, message)}`;
    };
    return this.provider.eth.dispatchSignedMEVBundle(params, connectionIdx, signer);
  }

  /**
   * Combine a human-readable tx and a nonce to create a hexadecimal tx
   *
   * @param tx an object describing the transaction
   * @param nonce the transaction's nonce, as an integer (base 10)
   * @returns the transaction with all fields converted to hex
   */
  private static parse(tx: ITx, nonce: number): ITxHex {
    return {
      nonce: Web3Utils.toHex(nonce),
      gasPrice: Web3Utils.toHex(tx.gasPrice.toFixed(0)),
      gasLimit: Web3Utils.toHex(tx.gasLimit.toFixed(0)),
      to: tx.to,
      value: tx.value,
      data: tx.data,
    };
  }

  /**
   * Convenience function that calls `provider.eth.getTransactionCount`
   *
   * @returns the next unconfirmed (possibly pending) nonce (base 10)
   */
  public getLowestLiquidNonce(): Promise<number> {
    return this.provider.eth.getTransactionCount(this.address);
  }

  /**
   * Convenience function that calls `provider.eth.getBalance`
   *
   * @returns the wallet's ETH balance, with 18 balances (1ETH = 1e18)
   */
  public getBalance(): Promise<string> {
    return this.provider.eth.getBalance(this.address);
  }

  /**
   * @param peer the wallet with which to share parameters
   */
  public shareOptsWithPeer(peer: Wallet): void {
    peer.init(this.opts);
  }

  /**
   * Constructs a new wallet and `init()`s it using the existing
   * instance's transaction opts. Useful for synchronously setting
   * up a new account on the same chain/hardfork.
   */
  public createPeer(): { wallet: Wallet; privateKey: string } {
    // Generate info for new wallet and LOG THE PRIVATE KEY IMMEDIATELY
    const { address, privateKey } = this.provider.eth.accounts.create();
    console.log(privateKey);

    // Setup new wallet (including call to `init()`)
    const peer = new Wallet(this.provider, address, privateKey.slice(2));
    this.shareOptsWithPeer(peer);

    return {
      wallet: peer,
      privateKey,
    };
  }
}
