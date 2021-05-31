export const DEFAULT_FLASHBOTS_RELAY = 'https://relay.flashbots.net';

export interface IFlashbotsBundleParams {
  txs: string[];
  revertingTxHashes?: string[];
  blockNumber: string;
  minTimestamp?: number;
  maxTimestamp?: number;
}

export interface IFlashbotsSimulationParams {
  txs: string[];
  blockNumber: string;
  stateBlockNumber: string;
  timestamp?: number;
}
