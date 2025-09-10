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
  import { getViem} from '../../shared/viem';
  import pkg from '../../package.json';
  const NODE_DEBUG_VERSION = `v${(pkg as any).version ?? 'unknown'}`;

  function sanitizeJsonLike(input: string): string {
    // Remove block comments
    let out = input.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove line comments that are not within strings (best-effort)
    out = out.replace(/(^|[^:"])(\/\/).*$/gm, (_m, p1) => p1);
    // Remove trailing commas before } or ]
    out = out.replace(/,(\s*[}\]])/g, '$1');
    // Trim BOM and whitespace
    out = out.replace(/^\uFEFF/, '').trim();
    return out;
  }

  function tryParseAbiJson(raw: string): any[] | undefined {
    const cleaned = sanitizeJsonLike(raw);
    try {
      const parsed = JSON.parse(cleaned);
      const candidate = Array.isArray(parsed) ? parsed : (parsed?.abi ?? parsed);
      if (Array.isArray(candidate)) return candidate as any[];
      return undefined;
    } catch {
      return undefined;
    }
  }

  function isReadOnlyFunctionItem(item: any): boolean {
    return item?.type === 'function' && ['view', 'pure'].includes(item?.stateMutability);
  }
  
  export class EvmContractRead implements INodeType {
    description: INodeTypeDescription = {
      displayName: 'EVM: Contract Read',
      name: 'evmContractRead',
      icon: 'file:icon.svg',
      group: ['transform'],
      version: 1,
      description: 'Call a read-only function on any EVM contract - foo',
      subtitle: "Version: " + NODE_DEBUG_VERSION,
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
          type: 'options',
          required: true,
          default: '',
          placeholder: '',
          description: 'Name of the function to call',
          typeOptions: {
            loadOptionsMethod: 'getFunctionNames',
            loadOptionsDependsOn: ['abiJson'],
          },
          noDataExpression: true,
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

    methods = {
        loadOptions: {
            async getFunctionNames(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
              const options: INodePropertyOptions[] = [];
              const rawAbi = (this.getCurrentNodeParameter('abiJson') as string) ?? '';
              const text = rawAbi.trim();
              if (!text) return options;
        
              // Try JSON ABI first
              let abi: any[] | undefined = tryParseAbiJson(text);
        
              // Fallback: human‑readable ABI (one signature per line)
              if (!abi) {
                try {
                  const viem = await getViem();
                  const lines = text
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (lines.length > 0) {
                    abi = viem.parseAbi(lines) as any[];
                  }
                } catch {
                  // swallow and return empty options below
                }
              }
        
              if (!abi) return options;
        
              // Keep only read-only functions by default (pure/view)
              const fnItems = (abi as any[]).filter((it) => it?.name && isReadOnlyFunctionItem(it));
        
              if (fnItems.length === 0) return options;
        
              // De-dup by name, mark overloads in labels
              const counts = new Map<string, number>();
              for (const f of fnItems) counts.set(f.name, (counts.get(f.name) ?? 0) + 1);
        
              const unique = Array.from(new Set(fnItems.map((f) => f.name))).sort((a, b) => a.localeCompare(b));
              for (const name of unique) {
                const label = (counts.get(name) ?? 1) > 1 ? `${name} (overloaded)` : name;
                options.push({ name: label, value: name });
              }
        
              return options;
            },
          },
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
          let abi: any[] | undefined = tryParseAbiJson(abiJson);
          if (!abi) {
            abi = viem.parseAbi([abiJson]) as any[];
          }
          const readOnlyAbi = (abi as any[]).filter(isReadOnlyFunctionItem);
          if (readOnlyAbi.length === 0) {
            throw new NodeOperationError(this.getNode(), new Error('ABI contains no read-only (view/pure) functions'));
          }
          const functionName = this.getNodeParameter('functionName', i) as string;
          const hasFunction = readOnlyAbi.some((f: any) => f?.name === functionName);
          if (!hasFunction) {
            throw new NodeOperationError(
              this.getNode(),
              new Error(`Function "${functionName}" is not read-only or not present in the provided ABI`),
            );
          }
          const argsStr = this.getNodeParameter('argsJson', i) as string;
          const args = argsStr?.trim() ? JSON.parse(argsStr) : [];
  
          const block = this.getNodeParameter('block', i, {}) as IDataObject;
          const blockNumber = Number(block.blockNumber) > 0 ? BigInt(block.blockNumber as number) : undefined;
          const blockTag = blockNumber ? undefined : (block.blockTag as 'latest'|'safe'|'finalized'|undefined);
  
          const result = await client.readContract({
            address,
            abi: readOnlyAbi,
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