import type {
    IExecuteFunctions,
    IDataObject,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
  } from 'n8n-workflow';
  import { NodeOperationError, NodeConnectionType } from 'n8n-workflow';
  import { makePublicClient } from '../../shared/evmClient';
  import { normalizeBigInt } from '../../shared/bigint';
  import { erc20Abi } from '../../shared/erc20';
  import { getViem} from '../../shared/viem';
  import { getNetworkConfig } from '../../shared/networkHelper';
  import { getPresetOptions } from '../../shared/networkPresets';
  import { advancedClientOptions } from '../../shared/clientConfig';
  
  export class EvmTokenBalance implements INodeType {
    description: INodeTypeDescription = {
      displayName: 'EVM: Token Balance',
      name: 'evmTokenBalance',
      icon: 'file:icon.svg',
      group: ['transform'],
      version: 1,
      description: 'Read ERC‑20 or native balance for an address',
      defaults: { name: 'EVM: Token Balance' },
      inputs: ['main'],
      outputs: ['main'],
      usableAsTool: true,
      credentials: [{ name: 'evmRpcApi', required: true }],
      properties: [
        {
          displayName: 'Network Preset',
          name: 'networkPreset',
          type: 'options',
          default: 'Custom',
          description: 'Select a network preset or use Custom for RPC from credentials',
          options: getPresetOptions(),
        },
        {
          displayName: 'Asset Type',
          name: 'assetType',
          type: 'options',
          default: 'erc20',
          options: [
            { name: 'ERC‑20', value: 'erc20' },
            { name: 'Native (ETH)', value: 'native' },
          ],
        },
        {
          displayName: 'Account Address',
          name: 'account',
          type: 'string',
          default: '',
          required: true,
          placeholder: '0x...',
          requiresDataPath: 'single',
        },
        {
          displayName: 'Token Address',
          name: 'token',
          type: 'string',
          default: '',
          placeholder: '0x...',
          displayOptions: { show: { assetType: ['erc20'] } },
        },
        {
          displayName: 'Block',
          name: 'block',
          type: 'collection',
          default: {},
          placeholder: 'Optional block selector',
          options: [
            { displayName: 'Block Tag', name: 'blockTag', type: 'options', default: 'latest',
              options: [{ name: 'latest', value: 'latest' }, { name: 'safe', value: 'safe' }, { name: 'finalized', value: 'finalized' }]},
            { displayName: 'Block Number', name: 'blockNumber', type: 'number', default: 0 },
          ],
        },
        {
          displayName: 'Format Output',
          name: 'formatOutput',
          type: 'boolean',
          default: true,
          description: 'If true, includes a human formatted balance using decimals',
        },
        advancedClientOptions,
      ],
    };
  
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
      const viem = await getViem();
      const items = this.getInputData();
      const returnData: IDataObject[] = [];
  
      // Get network configuration based on preset or credentials
      const networkConfig = await getNetworkConfig(this);
      const client = await makePublicClient(networkConfig.rpcUrl, networkConfig.headers, networkConfig);
  
      for (let i = 0; i < items.length; i++) {
        try {
          const assetType = this.getNodeParameter('assetType', i) as 'erc20'|'native';
          const account = viem.getAddress(this.getNodeParameter('account', i) as string);
          const block = this.getNodeParameter('block', i, {}) as IDataObject;
          const blockNumber = Number(block.blockNumber) > 0 ? BigInt(block.blockNumber as number) : undefined;
          const blockTag = blockNumber ? undefined : (block.blockTag as 'latest'|'safe'|'finalized'|undefined);
  
          if (assetType === 'native') {
            const bal = await client.getBalance({ address: account, ...(blockNumber ? { blockNumber } : { blockTag }) });
            returnData.push({
              assetType,
              account,
              balanceRaw: bal.toString(),
              // Not formatting to ethers directly because native decimals are 18
              balance: viem.formatUnits(bal, 18),
            });
          } else {
            const token = viem.getAddress(this.getNodeParameter('token', i) as string);
            const [decimals, symbol, raw] = await Promise.all([
              client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals', ...(blockNumber ? { blockNumber } : { blockTag }) }),
              client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol', ...(blockNumber ? { blockNumber } : { blockTag }) }),
              client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account], ...(blockNumber ? { blockNumber } : { blockTag }) }),
            ]);
  
            const out: IDataObject = {
              assetType,
              token,
              account,
              decimals,
              symbol,
              balanceRaw: (raw as bigint).toString(),
            };
            const formatOutput = this.getNodeParameter('formatOutput', i) as boolean;
            if (formatOutput) out.balance = viem.formatUnits(raw as bigint, Number(decimals));
            returnData.push(normalizeBigInt(out));
          }
        } catch (err) {
          throw new NodeOperationError(this.getNode(), err as Error);
        }
      }
  
      return [this.helpers.returnJsonArray(returnData)];
    }
  }