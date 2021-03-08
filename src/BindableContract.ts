import { EventEmitter } from 'events';
import { BlockNumber } from 'web3-core';
import { Contract as IWeb3Contract } from 'web3-eth-contract';
import Web3Utils from 'web3-utils';
import Web3 from 'web3';

import Contract from './Contract';

type StandardEnum = { [id: string]: string };

type AvailableEmitters<EventEnum extends StandardEnum> = {
  [_ in keyof EventEnum]: (fromBlock: BlockNumber) => EventEmitter;
};

interface IBindedContract<EventEnum extends StandardEnum> {
  subscribeTo: AvailableEmitters<EventEnum>;
}

export default class BindableContract<EventEnum extends StandardEnum> extends Contract {
  protected readonly creationBlock: number;

  protected readonly events: AvailableEmitters<EventEnum>;

  protected connectedInner: IWeb3Contract | null = null;

  constructor(address: string, abi: Web3Utils.AbiItem[], events: EventEnum, creationBlock: number) {
    super(address, abi);

    this.events = Object.fromEntries(
      Object.keys(events).map((event: keyof EventEnum) => {
        return [event, (fromBlock: BlockNumber) => this.subscribeTo(event, fromBlock)];
      }),
    ) as AvailableEmitters<EventEnum>;

    this.creationBlock = creationBlock;
  }

  public bindTo(provider: Web3): IBindedContract<EventEnum> {
    if (this.connectedInner === null) this.connectedInner = new provider.eth.Contract(this.abi, this.address);
    return { subscribeTo: this.events };
  }

  private subscribeTo(event: keyof EventEnum, fromBlock: BlockNumber): EventEmitter {
    return this.connectedInner!.events[event]({ fromBlock: fromBlock === 'earliest' ? this.creationBlock : fromBlock });
  }
}
