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

  const pausableAbi = [
    { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool', name: '' }]},
  ] as const;
  
  const ownableAbi = [
    { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address', name: '' }]},
  ] as const;
  
  export class EvmTokenHelper implements INodeType {
    description: INodeTypeDescription = {
      displayName: 'EVM: Token Helper',
      name: 'evmTokenHelper',
      icon: 'file:icon.svg',
      group: ['transform'],
      version: 1,
      description: 'Return token metadata and detect common flags',
      defaults: { name: 'EVM: Token Helper' },
      inputs: ['main'],
      outputs: ['main'],
      usableAsTool: true,
      credentials: [{ name: 'evmRpcApi', required: true }],
      properties: [
        {
          displayName: 'Token Address',
          name: 'token',
          type: 'string',
          default: '',
          required: true,
          placeholder: '0x...',
        },
        {
          displayName: 'Block',
          name: 'block',
          type: 'collection',
          default: {},
          options: [
            { displayName: 'Block Tag', name: 'blockTag', type: 'options', default: 'latest',
              options: [{ name: 'latest', value: 'latest' }, { name: 'safe', value: 'safe' }, { name: 'finalized', value: 'finalized' }]},
            { displayName: 'Block Number', name: 'blockNumber', type: 'number', default: 0 },
          ],
        },
      ],
    };
  
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
      const viem = await getViem();
      const items = this.getInputData();
      const returnData: IDataObject[] = [];
  
      const creds = await this.getCredentials('evmRpcApi');
      const rpcUrl = (creds as any).rpcUrl as string;
      const headersPairs = ((creds as any).headers?.header ?? []) as Array<{name:string,value:string}>;
      const headers = Object.fromEntries(headersPairs.filter(h => h?.name).map(h => [h.name, h.value]));
      const client = await makePublicClient(rpcUrl, headers);
  
      for (let i = 0; i < items.length; i++) {
        try {
          const token = viem.getAddress(this.getNodeParameter('token', i) as string);
          const block = this.getNodeParameter('block', i, {}) as IDataObject;
          const blockNumber = Number(block.blockNumber) > 0 ? BigInt(block.blockNumber as number) : undefined;
          const blockTag = blockNumber ? undefined : (block.blockTag as 'latest'|'safe'|'finalized'|undefined);
  
          const [name, symbol, decimals, totalSupply] = await Promise.all([
            client.readContract({ address: token, abi: erc20Abi, functionName: 'name', blockNumber, blockTag }),
            client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol', blockNumber, blockTag }),
            client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals', blockNumber, blockTag }),
            client.readContract({ address: token, abi: erc20Abi, functionName: 'totalSupply', blockNumber, blockTag }),
          ]);
  
          // Detect optional features best-effort
          let paused: boolean | null = null;
          let owner: string | null = null;
  
          try { paused = await client.readContract({ address: token, abi: pausableAbi, functionName: 'paused', blockNumber, blockTag }) as boolean; } catch {}
          try { owner = await client.readContract({ address: token, abi: ownableAbi, functionName: 'owner', blockNumber, blockTag }) as string; } catch {}
  
          returnData.push(normalizeBigInt({
            token,
            name, symbol, decimals, totalSupply,
            capabilities: { pausable: paused !== null, paused: paused ?? undefined, ownable: owner !== null, owner: owner ?? undefined },
            // Distribution will require an indexer or explorer API - plan below
          }));
        } catch (err) {
          throw new NodeOperationError(this.getNode(), err as Error);
        }
      }
  
      return [this.helpers.returnJsonArray(returnData)];
    }
  }