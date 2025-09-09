import {
    ICredentialType,
    INodeProperties,
    ICredentialTestRequest,
  } from 'n8n-workflow';
  
  export class EvmRpcApi implements ICredentialType {
    name = 'evmRpcApi';
    displayName = 'EVM RPC';
    properties: INodeProperties[] = [
      {
        displayName: 'RPC URL',
        name: 'rpcUrl',
        type: 'string',
        default: 'https://rpc.katana.network/',
        description: 'HTTP(S) JSON-RPC endpoint',
        required: true,
      },
      {
        displayName: 'Extra Headers',
        name: 'headers',
        type: 'fixedCollection',
        default: {},
        description: 'Optional additional headers for the RPC endpoint',
        typeOptions: { multipleValues: true },
        options: [
          {
            name: 'header',
            displayName: 'Header',
            values: [
              { displayName: 'Name', name: 'name', type: 'string', default: '' },
              { displayName: 'Value', name: 'value', type: 'string', default: '' },
            ],
          },
        ],
      },
    ];
  
    // Use a generic POST with eth_chainId to verify credentials on save.
    test: ICredentialTestRequest = {
      request: {
        method: 'POST',
        url: '={{$credentials.rpcUrl}}',
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        },
      },
    };
  }