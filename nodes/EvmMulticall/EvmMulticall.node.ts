import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { makePublicClient } from '../../shared/evmClient';
import { normalizeBigInt } from '../../shared/bigint';
import { getViem } from '../../shared/viem';
import { getNetworkConfig } from '../../shared/networkHelper';
import { getPresetOptions } from '../../shared/networkPresets';
import { advancedClientOptions } from '../../shared/clientConfig';

// Multicall3 is deployed at the same address on most chains
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

const multicall3Abi = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'callData', type: 'bytes' }
        ],
        name: 'calls',
        type: 'tuple[]'
      }
    ],
    name: 'aggregate',
    outputs: [
      { name: 'blockNumber', type: 'uint256' },
      { name: 'returnData', type: 'bytes[]' }
    ],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' }
        ],
        name: 'calls',
        type: 'tuple[]'
      }
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' }
        ],
        name: 'returnData',
        type: 'tuple[]'
      }
    ],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

export class EvmMulticall implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'EVM: Multicall',
    name: 'evmMulticall',
    icon: 'file:icon.svg',
    group: ['transform'],
    version: 1,
    description: 'Batch multiple contract reads in a single call',
    defaults: { name: 'EVM: Multicall' },
    inputs: ['main'],
    outputs: ['main'],
    usableAsTool: true,
    credentials: [
      { name: 'evmRpcApi', required: true },
    ],
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
        displayName: 'Multicall Address',
        name: 'multicallAddress',
        type: 'string',
        default: MULTICALL3_ADDRESS,
        description: 'Multicall3 contract address (default works on most chains)',
        placeholder: '0x...',
      },
      {
        displayName: 'Allow Failures',
        name: 'allowFailures',
        type: 'boolean',
        default: true,
        description: 'Whether to continue if some calls fail',
      },
      {
        displayName: 'Calls',
        name: 'calls',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        placeholder: 'Add Call',
        options: [
          {
            name: 'call',
            displayName: 'Call',
            values: [
              {
                displayName: 'Call ID',
                name: 'callId',
                type: 'string',
                default: '',
                description: 'Unique identifier for this call in the results',
                placeholder: 'getBalance1',
              },
              {
                displayName: 'Contract Address',
                name: 'contractAddress',
                type: 'string',
                default: '',
                required: true,
                placeholder: '0x...',
              },
              {
                displayName: 'ABI (JSON)',
                name: 'abiJson',
                type: 'string',
                typeOptions: { rows: 4 },
                default: '',
                required: true,
                description: 'ABI for the function to call',
              },
              {
                displayName: 'Function Name',
                name: 'functionName',
                type: 'string',
                default: '',
                required: true,
                placeholder: 'balanceOf',
              },
              {
                displayName: 'Arguments (JSON Array)',
                name: 'argsJson',
                type: 'string',
                default: '[]',
                typeOptions: { rows: 2 },
                placeholder: '["0xabc...", 123]',
              },
            ],
          },
        ],
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
        const multicallAddress = viem.getAddress(this.getNodeParameter('multicallAddress', i) as string);
        const allowFailures = this.getNodeParameter('allowFailures', i) as boolean;
        const callsData = this.getNodeParameter('calls', i) as IDataObject;
        const block = this.getNodeParameter('block', i, {}) as IDataObject;
        
        const blockNumber = Number(block.blockNumber) > 0 ? BigInt(block.blockNumber as number) : undefined;
        const blockTag = blockNumber ? undefined : (block.blockTag as 'latest' | 'safe' | 'finalized' | undefined);

        // Process calls
        const calls = ((callsData as any).call || []) as IDataObject[];
        if (calls.length === 0) {
          throw new NodeOperationError(this.getNode(), 'No calls provided');
        }

        const encodedCalls = [];
        const callMetadata = [];

        for (const call of calls) {
          const callId: string = (call.callId as string) || `call_${callMetadata.length}`;
          const contractAddress = viem.getAddress(call.contractAddress as string);
          const abiJson = call.abiJson as string;
          const functionName = call.functionName as string;
          const argsStr = call.argsJson as string;
          const args = argsStr?.trim() ? JSON.parse(argsStr) : [];

          // Parse ABI
          let abi: any[];
          try {
            abi = JSON.parse(abiJson);
          } catch {
            // Try human-readable ABI
            abi = viem.parseAbi([abiJson]) as any[];
          }

          // Encode function call
          const data = viem.encodeFunctionData({
            abi,
            functionName,
            args,
          });

          encodedCalls.push({
            target: contractAddress,
            allowFailure: allowFailures,
            callData: data,
          });

          callMetadata.push({
            callId,
            contractAddress,
            functionName,
            args,
            abi,
          });
        }

        // Execute multicall
        let results: any[];
        
        if (allowFailures) {
          // Use aggregate3 which supports failure handling
          const response = await client.readContract({
            address: multicallAddress,
            abi: multicall3Abi,
            functionName: 'aggregate3',
            args: [encodedCalls],
            blockNumber,
            blockTag,
          });
          results = response as any[];
        } else {
          // Use aggregate which reverts on any failure
          const simpleCalls = encodedCalls.map(c => ({ target: c.target, callData: c.callData }));
          const [, returnData] = await client.readContract({
            address: multicallAddress,
            abi: multicall3Abi,
            functionName: 'aggregate',
            args: [simpleCalls],
            blockNumber,
            blockTag,
          }) as [bigint, any[]];
          
          // Convert to aggregate3 format for consistent processing
          results = returnData.map((data: any) => ({ success: true, returnData: data }));
        }

        // Decode results
        const decodedResults: IDataObject[] = [];
        
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const metadata = callMetadata[j];
          
          if (result.success) {
            try {
              const decoded = viem.decodeFunctionResult({
                abi: metadata.abi,
                functionName: metadata.functionName,
                data: result.returnData,
              });
              
              decodedResults.push({
                callId: metadata.callId,
                success: true,
                contractAddress: metadata.contractAddress,
                functionName: metadata.functionName,
                args: metadata.args,
                result: normalizeBigInt(decoded),
              });
            } catch (decodeErr) {
              decodedResults.push({
                callId: metadata.callId,
                success: false,
                contractAddress: metadata.contractAddress,
                functionName: metadata.functionName,
                args: metadata.args,
                error: `Failed to decode result: ${(decodeErr as Error).message}`,
              });
            }
          } else {
            decodedResults.push({
              callId: metadata.callId,
              success: false,
              contractAddress: metadata.contractAddress,
              functionName: metadata.functionName,
              args: metadata.args,
              error: 'Call reverted',
            });
          }
        }

        returnData.push({
          multicallAddress,
          totalCalls: calls.length,
          successfulCalls: decodedResults.filter(r => r.success).length,
          failedCalls: decodedResults.filter(r => !r.success).length,
          results: decodedResults,
        });

      } catch (err) {
        throw new NodeOperationError(this.getNode(), err as Error);
      }
    }

    return [this.helpers.returnJsonArray(returnData)];
  }
}