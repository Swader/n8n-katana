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
  import { getViem} from '../../shared/viem';
  
  export class EvmContractRead implements INodeType {
    description: INodeTypeDescription = {
      displayName: 'EVM: Contract Read',
      name: 'evmContractRead',
      icon: 'file:icon.svg',
      group: ['transform'],
      version: 1,
      description: 'Call a read-only function on any EVM contract',
      defaults: { name: 'EVM: Contract Read' },
      inputs: ['main'],
      outputs: ['main'],
      // Optional - lets AI agents use it when allowed by admin
      usableAsTool: true,
      credentials: [
        { name: 'evmRpcApi', required: true },
      ],
      properties: [
        {
          displayName: 'Contract Address',
          name: 'contractAddress',
          type: 'string',
          required: true,
          default: '',
          placeholder: '0x...',
          description: 'Target contract address',
          requiresDataPath: 'single',
        },
        {
          displayName: 'ABI (JSON)',
          name: 'abiJson',
          type: 'string',
          typeOptions: { rows: 6 },
          required: true,
          default: '',
          description: 'Full or minimal ABI for the function you call',
        },
        {
          displayName: 'Function Name',
          name: 'functionName',
          type: 'string',
          required: true,
          default: '',
          placeholder: 'balanceOf',
          description: 'Name of the function to call',
          requiresDataPath: 'single',
        },
        {
          displayName: 'Arguments (JSON Array)',
          name: 'argsJson',
          type: 'string',
          default: '[]',
          description: 'Arguments as JSON, for example: ["0xabc...", 123]',
          typeOptions: { rows: 3 },
        },
        {
          displayName: 'Block',
          name: 'block',
          type: 'collection',
          default: {},
          placeholder: 'Optional block selector',
          options: [
            {
              displayName: 'Block Tag',
              name: 'blockTag',
              type: 'options',
              default: 'latest',
              options: [
                { name: 'latest', value: 'latest' },
                { name: 'safe', value: 'safe' },
                { name: 'finalized', value: 'finalized' },
              ],
            },
            {
              displayName: 'Block Number',
              name: 'blockNumber',
              type: 'number',
              default: 0,
              description: 'If set (> 0), overrides Block Tag',
            },
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
          const addressRaw = this.getNodeParameter('contractAddress', i) as string;
          const address = viem.getAddress(addressRaw);
          const abiJson = this.getNodeParameter('abiJson', i) as string;
          const abi = JSON.parse(abiJson);
          const functionName = this.getNodeParameter('functionName', i) as string;
          const argsStr = this.getNodeParameter('argsJson', i) as string;
          const args = argsStr?.trim() ? JSON.parse(argsStr) : [];
  
          const block = this.getNodeParameter('block', i, {}) as IDataObject;
          const blockNumber = Number(block.blockNumber) > 0 ? BigInt(block.blockNumber as number) : undefined;
          const blockTag = blockNumber ? undefined : (block.blockTag as 'latest'|'safe'|'finalized'|undefined);
  
          const result = await client.readContract({
            address,
            abi: Array.isArray(abi) ? abi : viem.parseAbi(abi),
            functionName,
            args,
            blockNumber,
            blockTag,
          });
  
          returnData.push({
            address,
            functionName,
            args,
            result: normalizeBigInt(result),
          });
        } catch (err) {
          throw new NodeOperationError(this.getNode(), err as Error);
        }
      }
  
      return [this.helpers.returnJsonArray(returnData)];
    }
  }