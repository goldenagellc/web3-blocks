import { expect } from 'chai';
const ganache = require('ganache-cli');
import Web3Utils from 'web3-utils';
import Web3 from 'web3';

import Big from '../src/types/big';
import Wallet from '../src/Wallet';
import { providerFor } from '../src/Providers';

require('dotenv-safe').config({
  example: '.env.ci.example',
});

describe('Wallet Test', () => {
  let mainnetProvider: Web3;
  let ganacheProvider: Web3;
  let wallet: Wallet;

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
    wallet = new Wallet(
      ganacheProvider,
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

  it('should retrieve lowest unconfirmed nonce', async () => {
    const nonce = await wallet.getLowestLiquidNonce();
    expect(typeof nonce).to.equal('number');
    expect(Number.isInteger(nonce)).to.be.true;
  }).timeout(4000);

  it('should sign transactions', () => {
    const tx = {
      nonce: Web3Utils.toHex('0'),
      gasPrice: Web3Utils.toHex('35000000000'),
      gasLimit: Web3Utils.toHex('21000'),
      to: '0x0123456789012345678901234567890123456789',
    };

    expect(typeof wallet['sign'](tx)).to.equal('string');
    expect(typeof wallet['sign']({ ...tx, value: '0x0' })).to.equal('string');
    expect(typeof wallet['sign']({ ...tx, data: Web3Utils.toHex('Hello World') })).to.equal('string');
  });

  it('should initialize chain opts', async () => {
    await wallet.init();
    expect(wallet['opts']).to.not.be.undefined;
  });

  it('should send a transaction', async () => {
    const nonce = await wallet.getLowestLiquidNonce();
    const tx = wallet.emptyTx;
    tx.gasPrice = Big(await ganacheProvider.eth.getGasPrice());
    const sentTx = wallet.signAndSend(tx, nonce);

    const receipt = Object(await sentTx);

    expect(receipt.status).to.be.true;
    expect(receipt.to).to.equal(wallet.address.toLowerCase());
    expect(receipt.to).to.equal(receipt.from);
    expect(receipt.gasUsed).to.equal(21000);
  }).timeout(4000);

  it('should estimate gas', async () => {
    const nonce = await wallet.getLowestLiquidNonce();
    const tx = wallet.emptyTx;
    tx.gasLimit = tx.gasLimit.mul('5');

    const gas = await wallet.estimateGas(tx, nonce);
    expect(gas).to.equal(21000);
  }).timeout(4000);

  it('should create peer', async () => {
    const peer = wallet.createPeer().wallet;
    const balance = await peer.getBalance();
    expect(balance).to.equal('0');
  }).timeout(4000);

  it('should send MEV bundle', async () => {
    const flashbotsProvider = providerFor('mainnet', { type: 'Flashbots' });
    const flashbotsWallet = new Wallet(
      flashbotsProvider,
      process.env.ACCOUNT_ADDRESS_TEST!,
      process.env.ACCOUNT_SECRET_TEST!,
    );
    
    const block = await mainnetProvider.eth.getBlockNumber();
    const nonce = await wallet.getLowestLiquidNonce();
    const tx = wallet.emptyTx;
    tx.gasLimit = tx.gasLimit.mul('5');

    let res = await flashbotsWallet.signAndSendMEVBundle([tx], [nonce], 0, block);
    expect(res).to.be.null;

    res = await flashbotsWallet.simulateMEVBundle([tx], [nonce - 1], 0, block, Date.now() / 1000);
    expect(res.totalGasUsed).to.equal(21000);
  }).timeout(4000);
});
