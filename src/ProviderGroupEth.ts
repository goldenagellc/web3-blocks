import { PromiEvent } from 'web3-core';
import { TransactionReceipt as ITxReceipt } from 'web3-eth';
import Web3 from 'web3';

import IProviderGroupEth from './types/IProviderGroupEth';

export default class ProviderGroupEth implements IProviderGroupEth {
  private readonly providers: Web3[];

  constructor(...providers: Web3[]) {
    this.providers = providers;
  }

  public clearSubscriptions(): void {
    // @ts-expect-error: Web3 typings are incorrect for `clearSubscriptions()`
    this.providers.forEach((p) => p.eth.clearSubscriptions());
  }

  public dispatchSignedTransaction(
    signedTx: string,
    mainConnectionIdx = 0,
    useAllConnections = true,
  ): PromiEvent<ITxReceipt> {
    if (useAllConnections) {
      const sentTxs = this.providers.map((provider) => provider.eth.sendSignedTransaction(signedTx));

      for (let i = 0; i < sentTxs.length; i += 1) {
        /* eslint-disable no-continue */
        if (i === mainConnectionIdx) continue;
        /* eslint-enable no-continue */
        sentTxs[i].on('error', (e: Error) => console.log(`${e.name} ${e.message}`));
      }
      return sentTxs[mainConnectionIdx];
    }

    return this.providers[mainConnectionIdx].eth.sendSignedTransaction(signedTx);
  }

  public dispatchSignedMEVBundle(
    params: any[],
    flashbotsConnectionIdx: number,
    signer: (request: string) => string,
  ): PromiEvent<any> {
    // @ts-ignore
    this.providers[flashbotsConnectionIdx]._provider._signer = signer;
    // @ts-expect-error: Custom Web3 extension
    return this.providers[flashbotsConnectionIdx].sendRawBundle(params[0], params[1], params[2], params[3]);
  }

  closeConnections(): void {
    this.providers.forEach((p) => {
      if (p.currentProvider === null) return;
      if (p.currentProvider.constructor.name === 'IpcProvider')
        try {
          // @ts-expect-error: We already checked that type is valid
          p.currentProvider.connection.close();
        } catch {
          // @ts-expect-error: We already checked that type is valid
          p.currentProvider.connection.destroy();
        }
      else if (p.currentProvider.constructor.name === 'WebsocketProvider') {
        // @ts-expect-error
        p.currentProvider.reconnectOptions.auto = false; // @ts-expect-error
        p.currentProvider.reset(); // @ts-expect-error
        p.currentProvider.disconnect();
      }
    });
  }
}
