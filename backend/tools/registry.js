
export const ToolRegistry = {
  
  GET_BALANCE: {
    description: "Get native token balance for an address",
    params: { address: "0x...", chain: "celo|aurora|harmony" },
    execute: async ({ web3, params }) => {
      if (!params.address) throw new Error("address is required")
      const balWei = await web3.eth.getBalance(params.address)
      return { balance: web3.utils.fromWei(balWei, 'ether') }
    },
    kind: "read",
  },

  
  SEND_NATIVE: {
    description: "Send native token from server signer to 'to'",
    params: { to: "0x...", amount: "in ether", chain: "celo|aurora|harmony" },

    simulate: async ({ web3, signer, params }) => {
      if (!params.to) throw new Error("to is required")
      if (params.amount == null) throw new Error("amount is required")
      const valueWei = web3.utils.toWei(String(params.amount), 'ether')
      const from = signer.address

      
      const gas = await web3.eth.estimateGas({ from, to: params.to, value: valueWei })
      const gasPrice = await web3.eth.getGasPrice()
      const chainId = await web3.eth.getChainId()
      return { gas, gasPrice, chainId }
    },

    execute: async ({ web3, signer, params }) => {
      if (!params.to) throw new Error("to is required")
      if (params.amount == null) throw new Error("amount is required")
      const valueWei = web3.utils.toWei(String(params.amount), 'ether')
      const from = signer.address

     
      const gas = await web3.eth
        .estimateGas({ from, to: params.to, value: valueWei })
        .catch((e) => {
          throw new Error("gas estimation failed: " + (e?.message || e))
        })

      const chainId = await web3.eth.getChainId()
      const latest = await web3.eth.getBlock("latest")
      const baseFee = latest && latest.baseFeePerGas ? BigInt(latest.baseFeePerGas) : null

      const tx = { from, to: params.to, value: valueWei, gas, chainId }

      if (baseFee !== null) {
        // EIP-1559 style
        const gp = BigInt(await web3.eth.getGasPrice())
        tx.maxPriorityFeePerGas = gp
        tx.maxFeePerGas = baseFee * 2n + gp // simple cushion
      } else {
        
        tx.gasPrice = await web3.eth.getGasPrice()
      }

      const receipt = await web3.eth.sendTransaction(tx).catch((e) => {
        const msg = e?.message || String(e)
        if (msg.toLowerCase().includes("insufficient")) {
          throw new Error("insufficient funds for amount + gas on selected chain")
        }
        throw new Error(msg)
      })

      return { txHash: receipt.transactionHash }
    },

    kind: "write",
  },

  
  DEPLOY_CONTRACT: {
    description: "Deploy a contract from ABI+bytecode",
    params: { abi: "[]", bytecode: "0x...", args: "[]", chain: "celo|aurora|harmony" },

    simulate: async ({ web3, signer, params }) => {
      if (!params.abi || !params.bytecode) throw new Error("abi and bytecode are required")
      const contract = new web3.eth.Contract(params.abi)
      const deployTx = contract.deploy({ data: params.bytecode, arguments: params.args || [] })
      const gas = await deployTx.estimateGas({ from: signer.address })
      const chainId = await web3.eth.getChainId()
      return { gas, chainId }
    },

    execute: async ({ web3, signer, params }) => {
      if (!params.abi || !params.bytecode) throw new Error("abi and bytecode are required")
      const contract = new web3.eth.Contract(params.abi)
      const deployTx = contract.deploy({ data: params.bytecode, arguments: params.args || [] })
      const gas = await deployTx.estimateGas({ from: signer.address })
      const instance = await deployTx.send({ from: signer.address, gas })
      return { address: instance.options.address }
    },

    kind: "write",
  },

 
  CONTRACT_CALL: {
    description: "Call a contract method (read or write)",
    params: { abi: "[]", address: "0x...", method: "string", args: "[]", write: "bool", chain: "celo|aurora|harmony" },

    simulate: async ({ web3, signer, params }) => {
      if (!params.abi) throw new Error("abi is required")
      if (!params.address) throw new Error("address is required")
      if (!params.method) throw new Error("method is required")
      const c = new web3.eth.Contract(params.abi, params.address)
      if (params.write) {
        const tx = c.methods[params.method](...(params.args || []))
        const gas = await tx.estimateGas({ from: signer.address })
        const chainId = await web3.eth.getChainId()
        return { gas, chainId }
      }
      return { ok: true }
    },

    execute: async ({ web3, signer, params }) => {
      if (!params.abi) throw new Error("abi is required")
      if (!params.address) throw new Error("address is required")
      if (!params.method) throw new Error("method is required")
      const c = new web3.eth.Contract(params.abi, params.address)
      if (params.write) {
        const tx = c.methods[params.method](...(params.args || []))
        const gas = await tx.estimateGas({ from: signer.address })
        const receipt = await tx.send({ from: signer.address, gas })
        return { txHash: receipt.transactionHash }
      } else {
        const result = await c.methods[params.method](...(params.args || [])).call()
        return { result }
      }
    },

    kind: "mixed",
  },
}
