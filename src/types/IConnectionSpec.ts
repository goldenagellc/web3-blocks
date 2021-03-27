export default interface IConnectionSpec {
  type: 'IPC' | 'WS_Infura' | 'WS_Alchemy' | 'HTTP_Infura' | 'HTTP_Alchemy' | 'Flashbots';
  envKeyPath?: string;
  envKeyID?: string;
  envKeyKey?: string;
}
