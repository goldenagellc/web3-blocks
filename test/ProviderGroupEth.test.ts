import { expect } from 'chai';

import { providersFor } from '../src/Providers';
import ProviderGroupEth from '../src/ProviderGroupEth';

require('dotenv-safe').config({
  example: '.env.ci.example',
});

describe('ProviderGroupEth Test', () => {
  let providerEth: ProviderGroupEth;

  it('should construct', () => {
    providerEth = new ProviderGroupEth(
      ...providersFor('mainnet', [
        {
          type: 'WS_Infura',
          envKeyID: 'PROVIDER_INFURA_ID',
        },
        {
          type: 'WS_Alchemy',
          envKeyKey: 'PROVIDER_ALCHEMY_KEY',
        },
      ]),
    );
  });

  it('should clear subscriptions', () => {
    providerEth.clearSubscriptions();
  });

  it('should close connections', () => {
    providerEth.closeConnections();
  });
});
