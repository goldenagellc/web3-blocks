import EthCrypto from 'eth-crypto';
import { hashMessage, id as hashId } from '@ethersproject/hash';
import { PromiEvent } from 'web3-core';

import ITx from './types/ITx';
import { IFlashbotsBundleParams, IFlashbotsSimulationParams } from './types/Flashbots';

import Wallet from './Wallet';

export default class FlashbotsWallet extends Wallet {
  public signAndSendFBBundle(
    txs: (string | ITx)[],
    nonces: number[],
    connectionIdx: number,
    targetBlock: number,
    revertingTxHashes: string[] | null = null,
  ): PromiEvent<any> {
    return this.sendFlashbotsBundle(
      this.signFlashbotsBundle(txs, nonces),
      revertingTxHashes,
      connectionIdx,
      targetBlock,
    );
  }

  public signAndSimulateFBBundle(
    txs: (string | ITx)[],
    nonces: number[],
    connectionIdx: number,
    targetBlock: number,
  ): Promise<any> {
    return this.simulateFlashbotsBundle(this.signFlashbotsBundle(txs, nonces), connectionIdx, targetBlock);
  }

  private simulateFlashbotsBundle(signedTxs: string[], connectionIdx: number, targetBlock: number) {
    const params: IFlashbotsSimulationParams = {
      txs: signedTxs,
      blockNumber: `0x${targetBlock.toString(16)}`,
      stateBlockNumber: 'latest',
      timestamp: undefined,
    };
    const signer = this.createFlashbotsHeaderSigner();
    return this.provider.eth.simulateSignedMEVBundle(params, connectionIdx, signer);
  }

  private sendFlashbotsBundle(
    signedTxs: string[],
    revertingTxHashes: string[] | null,
    connectionIdx: number,
    targetBlock: number,
  ): PromiEvent<any> {
    const params: IFlashbotsBundleParams = {
      txs: signedTxs,
      revertingTxHashes: revertingTxHashes ?? undefined,
      blockNumber: `0x${targetBlock.toString(16)}`,
    };
    const signer = this.createFlashbotsHeaderSigner();
    return this.provider.eth.dispatchSignedMEVBundle(params, connectionIdx, signer);
  }

  private signFlashbotsBundle(txs: (string | ITx)[], nonces: number[]) {
    return txs.map((tx, i) => {
      if (typeof tx === 'string') return tx;
      return this.sign(Wallet.parse(tx, nonces[i]));
    });
  }

  private createFlashbotsHeaderSigner() {
    return (request: string): string => {
      const message = hashMessage(hashId(request));
      return `${this.address}:${EthCrypto.sign(this.privateKey, message)}`;
    };
  }
}
