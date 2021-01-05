import { PromiEvent, TransactionReceipt as ITxReceipt } from 'web3-core';

/* eslint-disable prefer-rest-params */

const QueueSafePromiEvent = (inner: PromiEvent<ITxReceipt>): PromiEvent<ITxReceipt> => {
  return new Proxy(inner, {
    get(target: PromiEvent<ITxReceipt>, prop: keyof PromiEvent<ITxReceipt>) {
      if (prop === 'on' && (arguments[0] === 'receipt' || arguments[0] === 'error'))
        throw new Error(`Queue has ownership of the ${arguments[0]} listener. Please use callback`);
      return Reflect.get(target, prop);
    },
  });
};

export default QueueSafePromiEvent;
