import { expect } from 'chai';
const ganache = require('ganache-cli');
import Web3 from 'web3';

import FlashbotsWallet from '../src/FlashbotsWallet';
import { providerFor } from '../src/Providers';
import IProviderGroup from '../src/types/IProviderGroup';
import ProviderGroup from '../src/ProviderGroup';

require('dotenv-safe').config({
  example: '.env.ci.example',
});

describe('Flashbots Wallet Test', () => {
  let mainnetProvider: Web3;
  let ganacheProvider: Web3;
  let providers: IProviderGroup;
  let wallet: FlashbotsWallet;

  before(() => {
    mainnetProvider = providerFor('mainnet', {
      type: 'WS_Infura',
      envKeyID: 'PROVIDER_INFURA_ID',
    });
    ganacheProvider = new Web3(
      ganache.provider({
        fork: mainnetProvider,
        accounts: [
          {
            balance: '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
            secretKey: '0x' + process.env.ACCOUNT_SECRET_TEST,
          },
          { balance: '0x0' },
          { balance: '0x0' },
          { balance: '0x0' },
        ],
      }),
    );
    providers = new ProviderGroup(ganacheProvider, providerFor('mainnet', { type: 'Flashbots' }));

    wallet = new FlashbotsWallet(
      providers,
      String(process.env.ACCOUNT_ADDRESS_TEST),
      String(process.env.ACCOUNT_SECRET_TEST),
    );
  });

  after(() => {
    // @ts-expect-error
    ganacheProvider.eth.clearSubscriptions();
    // @ts-expect-error
    mainnetProvider.eth.clearSubscriptions();
    if (
      mainnetProvider.currentProvider !== null &&
      (mainnetProvider.currentProvider.constructor.name === 'WebsocketProvider' ||
        mainnetProvider.currentProvider.constructor.name === 'IpcProvider')
    )
      try {
        // @ts-ignore
        mainnetProvider.currentProvider.connection.close();
      } catch {
        // @ts-ignore
        mainnetProvider.currentProvider.connection.destroy();
      }
  });

  it('should simulate bundle', async () => {
    const block = await mainnetProvider.eth.getBlockNumber();
    const nonce = await wallet.getLowestLiquidNonce();
    const tx = wallet.emptyTx;
    tx.gasLimit = tx.gasLimit.mul('5');

    let res = await wallet.signAndSimulateFBBundle([tx], [nonce], 1, block);
    /* Something like...

    {
      bundleGasPrice: '0',
      bundleHash: '0xfb3b642c21fc8a1e5dbc2ac0d334bae6988bb39732c2f85c2a87d5de57b3cdc5',
      coinbaseDiff: '0',
      ethSentToCoinbase: '0',
      gasFees: '0',
      results: [
        {
          coinbaseDiff: '0',
          ethSentToCoinbase: '0',
          fromAddress: '0x7e3A0C2300175FF712742c21F36216e9fb63b487',
          gasFees: '0',
          gasPrice: '0',
          gasUsed: 21000,
          toAddress: '0x7e3A0C2300175FF712742c21F36216e9fb63b487',
          txHash: '0xc4be689058bd9891bb7a0dc52551b04fb7445ffb5c75757f5a496a5e8f799ed3',
          value: '0x'
        }
      ],
      stateBlockNumber: 12539778,
      totalGasUsed: 21000
    }
    */
    expect(res.results[0].gasUsed).to.equal(21000);
  }).timeout(5000);

  it('should send bundle', async () => {
    const block = await mainnetProvider.eth.getBlockNumber();
    const nonce = await wallet.getLowestLiquidNonce();
    const tx = wallet.emptyTx;
    tx.gasLimit = tx.gasLimit.mul('5');

    let res = await wallet.signAndSendFBBundle([tx], [nonce], 1, block);
    /* Something like...

    {
      bundleHash: '0xfb3b642c21fc8a1e5dbc2ac0d334bae6988bb39732c2f85c2a87d5de57b3cdc5'
    }
    */
   expect(res.bundleHash).to.exist;
  }).timeout(5000);
});
