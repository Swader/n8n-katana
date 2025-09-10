# n8n blockchain tools

This set of nodes helps you interact with blockchains - primarily reading
balances and contracts based on their ABI.

## TODO

- [x] Add a loadOptions method to parse ABI and populate function names from
  abiJson.
- [ ] Filter out non-const functions from EvmContractRead since it's read-only.
- [ ] Add an optional Network Preset dropdown (Katana, mainnet, etc.), but still
  require the RPC credential.
- [ ] Add a Multicall node (batch reads).
- [ ] Add retry and rate limit handling in shared/evmClient.ts.
- [ ] Add Explorer ABI Fetcher node for katanascan compat (fetch verified ABI to
  feed Contract Read).
- [ ] Send Transaction node with a dedicated signer credential (never store
  private keys in the same credential as RPC).
