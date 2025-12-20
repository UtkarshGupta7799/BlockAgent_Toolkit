<div align="center">
  <img src="https://raw.githubusercontent.com/UtkarshGupta7799/BlockAgent_Toolkit/main/blockagent-banner.png"
       alt="BlockAgent Toolkit — AI-Powered Blockchain Interaction"
       width="100%" />
</div>

# BlockAgent Toolkit

An AI-powered toolkit that simplifies **secure blockchain interactions** across **EVM-compatible networks**, including **Celo**, **Aurora**, and **Harmony**.

BlockAgent abstracts low-level Web3 workflows into **safe, high-level interaction flows**, enabling faster development and reduced operational complexity for decentralized applications.

---

## System Overview

BlockAgent Toolkit provides a middleware layer that translates user intent into structured blockchain actions.  
It is designed to support **multi-network environments**, common smart contract operations, and scalable transaction handling.

The toolkit is suitable for:
- dApp backends  
- Developer tooling  
- AI-assisted blockchain workflows  

---

## Key Capabilities

- **Multi-Network Support**  
  Compatible with EVM-based chains such as Celo, Aurora, and Harmony.

- **Transaction Abstraction**  
  High-level APIs for wallet creation, balance queries, contract deployment, and contract interaction.

- **AI-Assisted Intent Handling**  
  Converts natural-language-style requests into deterministic API calls.

- **Scalable Design**  
  Architected to support **50+ dApp-style use cases** and **1,000+ transactions per month**.

- **Developer-Friendly Tooling**  
  Integrated **Hardhat** environment for compiling and deploying Solidity contracts.

---

## Architecture

- **API Layer**  
  Node.js + Express REST API handling request validation, signing, and transaction submission.

- **Blockchain Interface**  
  Web3.js-based interaction layer for EVM-compatible networks.

- **Smart Contract Tooling**  
  Hardhat project for contract compilation and deployment workflows.

- **UI Layer**  
  Streamlit-based interface for interacting with blockchain actions using natural-language-style inputs.

---

## Components

- **/backend** — REST API for blockchain operations and transaction orchestration  
- **/contracts** — Hardhat project containing sample Solidity contracts  
- **/streamlit_app** — Interactive UI for issuing blockchain actions  
- **Web3 Provider Layer** — Network RPC configuration and transaction handling  

---

## Security Considerations

- Designed for **testnet and development use** only  
- Private keys should never contain real funds  
- Production deployments should use:
  - Hardware Security Modules (HSMs)
  - Managed wallet services
  - Custodial or MPC-based key management solutions  

---

## Use Cases

- AI-assisted blockchain interaction layers  
- Developer tooling for smart contract deployment and testing  
- Multi-chain dApp backend services  
- Educational and research-focused blockchain systems  

---

⭐ If you find this project useful, consider starring the repository.


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

---

## Disclaimer

This toolkit is intended for **development, testing, and educational purposes**.  
It is not designed for handling real funds or production-grade key management.

---

## What you get
- **web3.js + REST API** to sign/send transactions, deploy and call contracts.
- **Hardhat** project to compile/deploy a sample Solidity contract.

Enjoy!
