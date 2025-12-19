# BlockAgent Toolkit

AI-powered toolkit that makes secure blockchain interactions easy across EVM-compatible networks (Celo, Aurora, Harmony).  
Tech stack: **Web3.js** (on Node), **REST API (Express)**.  
Targets 50+ dApps style use-cases and 1,000+ tx/month scale with simple, safe flows.

### 1) Start the backend
```bash
cd backend
npm install
npm start
```

### 2) Build the contract bundle
```bash
cd ../contracts
npm install
npx hardhat compile
```

### 3) Start the Streamlit app 
```bash
cd ../streamlit_app
pip install -r requirements.txt
streamlit run app.py
```
Your browser opens. Type simple requests like:
- "create a new wallet"
- "check my balance on celo"
- "deploy simple storage"
- "set value 42 on my storage"
- "call read on storage"

The app translates your words → API calls.

### 5) Safety
- **NEVER** use a real/private key with funds here.
- Use **testnets** only.
- For production, use HSMs, managed wallets, or custodial services.

---

## What you get
- **web3.js + REST API** to sign/send transactions, deploy and call contracts.
- **Hardhat** project to compile/deploy a sample Solidity contract.

Enjoy!
