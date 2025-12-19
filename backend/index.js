import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { Web3 } from 'web3'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ToolRegistry } from './tools/registry.js'

const app = express()
app.use(cors())
app.use(express.json())


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Access logs to stdout (Render captures this)
app.use(morgan('combined'))


const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 })
app.use(limiter)

// Security: Simple API Secret Middleware
app.use((req, res, next) => {
  const secret = process.env.API_SECRET
  if (!secret) return next() // Open mode if not set
  const auth = req.headers['x-api-secret']
  if (auth !== secret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API_SECRET' })
  }
  next()
})

// audit helper
function audit(event, data) {
  // Stdout logging for audit trails
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }))
}

function isValidAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

const CHAIN_CONFIG = {
  celo: { rpc: process.env.CELO_RPC, chainId: 44787 }, // Alfajores
  aurora: { rpc: process.env.AURORA_RPC, chainId: 1313161555 }, // Aurora testnet
  harmony: { rpc: process.env.HARMONY_RPC, chainId: 1666700000 }, // Harmony testnet shard0
}

export function getWeb3(forChain) {
  const chain = forChain || process.env.DEFAULT_CHAIN || 'celo'
  const cfg = CHAIN_CONFIG[chain]
  if (!cfg || !cfg.rpc) {
    throw new Error(`Missing RPC for chain '${chain}'. Check .env`)
  }
  const provider = new Web3.providers.HttpProvider(cfg.rpc, {
    timeout: 10000, // 10s timeout for RPC calls
  })
  return { web3: new Web3(provider), chain }
}

app.get('/ping', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

function getSigner(web3) {
  const pk = process.env.PRIVATE_KEY
  if (!pk) throw new Error('PRIVATE_KEY missing in .env')
  const account = web3.eth.accounts.privateKeyToAccount(pk)
  web3.eth.accounts.wallet.clear()
  web3.eth.accounts.wallet.add(account)
  web3.eth.defaultAccount = account.address
  return account
}

app.get('/', (_, res) => res.json({ ok: true, name: 'BlockAgent Backend' }))

app.post('/wallet/new', (req, res) => {
  const { web3 } = getWeb3(req.body?.chain)
  const acct = web3.eth.accounts.create()
  res.json({ address: acct.address, privateKey: acct.privateKey })
})

app.get('/balance', async (req, res) => {
  try {
    const address = req.query.address
    if (!isValidAddress(address)) throw new Error('Invalid address format')
    const { web3, chain } = getWeb3(req.query.chain)
    const balWei = await web3.eth.getBalance(address)
    const bal = web3.utils.fromWei(balWei, 'ether')
    res.json({ chain, address, balance: bal })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/tx/send', async (req, res) => {
  try {
    const { to, amount, chain } = req.body // amount in ETH/CELO/ONE
    if (!isValidAddress(to)) throw new Error('Invalid "to" address format')
    const { web3 } = getWeb3(chain)
    const signer = getSigner(web3)
    const tx = {
      from: signer.address,
      to,
      value: web3.utils.toWei(String(amount), 'ether'),
      gas: 21000,
    }
    const receipt = await web3.eth.sendTransaction(tx)
    res.json({ txHash: receipt.transactionHash, from: signer.address, to, amount })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/contract/deploy', async (req, res) => {
  try {
    const { abi, bytecode, args = [], chain } = req.body
    if (!abi || !bytecode) throw new Error('abi and bytecode are required')
    const { web3 } = getWeb3(chain)
    const signer = getSigner(web3)
    const contract = new web3.eth.Contract(abi)
    const deployTx = contract.deploy({ data: bytecode, arguments: args })
    const gas = await deployTx.estimateGas({ from: signer.address })
    const instance = await deployTx.send({ from: signer.address, gas })
    res.json({ address: instance.options.address })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/contract/call', async (req, res) => {
  try {
    const { abi, address, method, args = [], write = false, chain } = req.body
    const { web3 } = getWeb3(chain)
    const contract = new web3.eth.Contract(abi, address)
    if (!write) {
      const result = await contract.methods[method](...args).call()
      res.json({ result })
    } else {
      const signer = getSigner(web3)
      const tx = contract.methods[method](...args)
      const gas = await tx.estimateGas({ from: signer.address })
      const receipt = await tx.send({ from: signer.address, gas })
      res.json({ txHash: receipt.transactionHash })
    }
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})


app.get('/wallet/from-env', (req, res) => {
  try {
    const { web3 } = getWeb3(req.query.chain)
    const acct = getSigner(web3)
    return res.json({ address: acct.address })
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }
})


const port = process.env.PORT || 4000
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`))



import policy from './policy.json' assert { type: 'json' }
function enforcePolicy(toolName, params, web3) {
  if (!policy.allowedTools.includes(toolName)) {
    throw new Error(`Tool ${toolName} not allowed by policy`)
  }
  if (toolName === 'SEND_NATIVE' && params.amount) {
    const max = web3.utils.toWei(policy.maxAmountEther, 'ether')
    const amt = web3.utils.toWei(String(params.amount), 'ether')
    if (BigInt(amt) > BigInt(max)) throw new Error('Amount exceeds policy limit')
  }
  if (toolName === 'CONTRACT_CALL' && params.method) {
    const lower = String(params.method).toLowerCase()
    if (policy.blockedMethods.some(b => lower.includes(b))) {
      throw new Error(`Method ${params.method} blocked by policy`)
    }
  }
}



app.post('/agent/plan', async (req, res) => {
  try {
    const text = String(req.body?.prompt || '')
    const t = text.toLowerCase().trim()
    const chain = req.body?.chain || null

    // robust address match (accept mixed case, 0x + 40 hex chars)
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/)
    const addr = addrMatch ? addrMatch[0] : (req.body?.address || null)

    // amount (first number in text)
    const amtMatch = text.match(/(\d+(\.\d+)?)/)
    const amt = amtMatch ? parseFloat(amtMatch[0]) : (req.body?.amount || null)

    let plan = null
    if (t.includes('balance')) {
      plan = { tool: 'GET_BALANCE', params: { address: addr, chain } }
    } else if (t.includes('send')) {
      plan = { tool: 'SEND_NATIVE', params: { to: addr, amount: amt, chain } }
    } else if (t.includes('deploy') && t.includes('storage')) {
      plan = { tool: 'DEPLOY_CONTRACT', params: { tag: 'SimpleStorage', chain } }
    } else if (t.includes('set value') || t.includes('set storage')) {
      // default to 0 if no number found
      const valMatch = text.match(/(\d+)/)
      const val = valMatch ? parseInt(valMatch[0], 10) : 0
      plan = { tool: 'CONTRACT_CALL', params: { method: 'set', args: [val], write: true, chain } }
    } else if (t.includes('read') || t.includes('get value')) {
      plan = { tool: 'CONTRACT_CALL', params: { method: 'get', args: [], write: false, chain } }
    }

    return res.json({ plan, note: plan ? 'OK' : 'UNKNOWN' })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})


app.post('/agent/execute', async (req, res) => {
  try {
    const { plan, abi, bytecode, address } = req.body
    if (!plan?.tool) throw new Error('Missing plan.tool')

    const tool = ToolRegistry[plan.tool]
    if (!tool) throw new Error(`Unknown tool ${plan.tool}`)

    const chain = plan.params?.chain
    const { web3 } = getWeb3(chain)

    // signer only if needed
    const needsSigner = tool.kind !== 'read'
    const signer = needsSigner ? getSigner(web3) : null

    // hydrate params from plan + body (allow overrides)
    let params = { ...(plan.params || {}) }
    if (address && !params.address) params.address = address

    // SimpleStorage convenience
    if (plan.tool === 'DEPLOY_CONTRACT' && params.tag === 'SimpleStorage') {
      if (!abi || !bytecode) throw new Error('abi+bytecode required for SimpleStorage deploy')
      params = { ...params, abi, bytecode, args: [] }
    }

    if (plan.tool === 'CONTRACT_CALL') {
      if (!abi) throw new Error('abi is required for contract call')
      if (!params.address) throw new Error('contract address is required for contract call')
      params = { ...params, abi }
    }

    if (plan.tool === 'GET_BALANCE') {
      if (!params.address) throw new Error('wallet address is required for balance check')
    }

    // policy checks (caps, blocklist, allowlist)
    enforcePolicy(plan.tool, params, web3)

    // simulate if supported
    let simulation = null
    if (tool.simulate) simulation = await tool.simulate({ web3, signer, params })

    // auto-execute read tools (no approval needed)
    if (tool.kind === 'read') {
      const result = await tool.execute({ web3, signer, params })
      audit('execute', { tool: plan.tool, params, result })
      return res.json({ simulation, result })
    }

    // write/mixed need approval
    if (!req.body?.approve) {
      return res.json({ simulation, note: 'Not executed; set approve=true to run (write op).' })
    }

    const result = await tool.execute({ web3, signer, params })
    audit('execute', { tool: plan.tool, params, result })
    res.json({ simulation, result })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Get the server signer address (derived from PRIVATE_KEY)
app.get('/wallet/from-env', (req, res) => {
  try {
    const { web3 } = getWeb3(req.query.chain)
    const acct = getSigner(web3)   // derives account from PRIVATE_KEY
    return res.json({ address: acct.address })
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }
})
