import os
import json
import streamlit as st
import requests
from intent_router import parse_prompt

BACKEND = os.environ.get("BLOCKAGENT_BACKEND", "http://localhost:4000")
if not BACKEND.startswith("http"):
    # If it looks like a domain (has dots) and not localhost, assume HTTPS
    # If it looks like an internal hostname (no dots) or localhost, assume HTTP
    if "." in BACKEND and "localhost" not in BACKEND:
        BACKEND = f"https://{BACKEND}"
    else:
        BACKEND = f"http://{BACKEND}"
API_SECRET = os.environ.get("API_SECRET", "")

st.set_page_config(page_title="BlockAgent Toolkit", page_icon="🧰")

st.title("🧰 BlockAgent Toolkit")
st.caption("Web3.js REST API + Streamlit AI interface (Celo • Aurora • Harmony testnets)")

with st.expander("Backend URL", expanded=False):
    BACKEND = st.text_input("REST base URL", BACKEND)
    st.write("Tip: keep it as http://localhost:4000 while testing locally.")
    if st.button("Ping Backend"):
        data, err = call_backend("GET", "/ping")
        if err: st.error(err)
        else: st.success(f"Pong! {data}")

user_text = st.text_input("Tell me what to do (try: 'create a new wallet', 'check my balance on celo', 'deploy simple storage')")
go = st.button("Go")


if "storage_addr" not in st.session_state:
    st.session_state.storage_addr = ""

def call_backend(method, path, **kwargs):
    url = f"{BACKEND}{path}"
    try:
        headers = {}
        if API_SECRET:
            headers["x-api-secret"] = API_SECRET
        
        if method == "GET":
            # Increased timeout to handle Render Free Tier cold starts (can take 50s+)
            r = requests.get(url, params=kwargs, headers=headers, timeout=120)
        else:
            r = requests.post(url, json=kwargs, headers=headers, timeout=120)
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        return None, str(e)

if go and user_text:
    intent = parse_prompt(user_text)
    st.write(f"Intent: `{intent.action}`  | Chain: `{intent.chain or 'default'}`")

    if intent.action == "NEW_WALLET":
        data, err = call_backend("POST", "/wallet/new", chain=intent.chain)
        if err:
            st.error(err)
        else:
            st.success("New wallet created")
            st.json(data)

    elif intent.action == "GET_BALANCE":
        # Check if address was in the prompt, otherwise check session state or ask
        address = intent.address
        
        # If no address in prompt, we need a way to ask without losing context
        # Ideally, the user provides it in the prompt. If not, we show an input but
        # need to handle the re-run. For now, let's just warn if missing to keep it simple
        # or rely on a separate "Address" field at the top if needed.
        # BETTER FIX: Use session state to store the "last intent" and "last address"
        
        if address:
             data, err = call_backend("GET", "/balance", address=address, chain=intent.chain)
             if err:
                 st.error(err)
             else:
                 st.json(data)
        else:
             st.warning("Please include the address in your request. Example: 'check balance of 0x...'")


    elif intent.action == "DEPLOY_SIMPLE_STORAGE":
      
        abi = [
            {"inputs": [{"internalType":"uint256","name":"newValue","type":"uint256"}],"name":"set","outputs":[],"stateMutability":"nonpayable","type":"function"},
            {"inputs":[],"name":"get","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"anonymous":False,"inputs":[{"indexed":False,"internalType":"uint256","name":"newValue","type":"uint256"}],"name":"ValueChanged","type":"event"}
        ]
       
        bytecode = "0x608060405234801561001057600080fd5b5061012b806100206000396000f3fe608060405260043610601f5760003560e01c806360fe47b11460245780636d4ce63c14603e575b600080fd5b603c6004803603810190603891906100b6565b6056565b005b6044605c565b604051605191906100e1565b60405180910390f35b60005481565b60008054905090565b600081359050607081610114565b92915050565b600060208284031215608657600080fd5b600061009484828501606a565b91505092915050565b6100a681610107565b82525050565b60006020820190506100c1600083018461009d565b92915050565b6000819050919050565b6100db81610107565b81146100e657600080fd5b50565b6000813590506100f88161011f565b92915050565b600080fd5b61010c81610107565b811461011757600080fd5b5056fea2646970667358221220a1d3d7d0a0d9c23a4c4fb2b0bd4c9d9d6e0773f3941d1b7a6f2d7a3d2b0a9a7d64736f6c63430008140033"
        payload = {"abi": abi, "bytecode": bytecode, "args": [], "chain": intent.chain}
        data, err = call_backend("POST", "/contract/deploy", **payload)
        if err:
            st.error(err)
        else:
            st.success("Contract deployed")
            st.json(data)
            st.session_state.storage_addr = data.get("address","")

    elif intent.action == "SET_STORAGE":
        addr = st.text_input("Contract address", value=st.session_state.storage_addr or "", key="set_addr")
        if addr:
            abi = [
                {"inputs": [{"internalType":"uint256","name":"newValue","type":"uint256"}],"name":"set","outputs":[],"stateMutability":"nonpayable","type":"function"},
                {"inputs":[],"name":"get","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            ]
            payload = {"abi": abi, "address": addr, "method": "set", "args": [int(intent.value or 0)], "write": True, "chain": intent.chain}
            data, err = call_backend("POST", "/contract/call", **payload)
            if err:
                st.error(err)
            else:
                st.success("Transaction sent")
                st.json(data)
        else:
            st.warning("Please paste the contract address.")

    elif intent.action == "READ_STORAGE":
        addr = st.text_input("Contract address", value=st.session_state.storage_addr or "", key="read_addr")
        if addr:
            abi = [
                {"inputs": [{"internalType":"uint256","name":"newValue","type":"uint256"}],"name":"set","outputs":[],"stateMutability":"nonpayable","type":"function"},
                {"inputs":[],"name":"get","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            ]
            payload = {"abi": abi, "address": addr, "method": "get", "args": [], "write": False, "chain": intent.chain}
            data, err = call_backend("POST", "/contract/call", **payload)
            if err:
                st.error(err)
            else:
                st.json(data)
        else:
            st.warning("Please paste the contract address.")

    else:
        st.info("I didn't understand. Try: 'create a new wallet', 'balance 0x... on aurora', 'deploy simple storage'")


st.header("🤖 Agent Flow (Plan → Simulate → Approve)")
prompt = st.text_input("What should I do? (e.g., 'send 0.01 to 0xabc.. on harmony')", key="agent_prompt")
chain_opt = st.selectbox("Chain (optional)", ["default", "celo", "aurora", "harmony"], index=0)
if st.button("Plan"):
    payload = {"prompt": prompt, "chain": None if chain_opt=="default" else chain_opt}
    plan, err = call_backend("POST", "/agent/plan", **payload)
    if err:
        st.error(err)
    else:
        st.session_state.plan = plan.get("plan")
        st.json(plan)

if "plan" in st.session_state and st.session_state.plan:
    st.subheader("Provide details (if needed)")
    plan = st.session_state.plan
    abi = None; bytecode = None; address = None

    if plan["tool"] == "DEPLOY_CONTRACT":
        st.write("Using SimpleStorage ABI+bytecode included in app.")
        # reuse the same abi/bytecode declared above in this file
        abi = [
            {"inputs": [{"internalType":"uint256","name":"newValue","type":"uint256"}],"name":"set","outputs":[],"stateMutability":"nonpayable","type":"function"},
            {"inputs":[],"name":"get","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"anonymous":False,"inputs":[{"indexed":False,"internalType":"uint256","name":"newValue","type":"uint256"}],"name":"ValueChanged","type":"event"}
        ]
        bytecode = "0x608060405234801561001057600080fd5b5061012b806100206000396000f3fe608060405260043610601f5760003560e01c806360fe47b11460245780636d4ce63c14603e575b600080fd5b603c6004803603810190603891906100b6565b6056565b005b6044605c565b604051605191906100e1565b60405180910390f35b60005481565b60008054905090565b600081359050607081610114565b92915050565b600060208284031215608657600080fd5b600061009484828501606a565b91505092915050565b6100a681610107565b82525050565b60006020820190506100c1600083018461009d565b92915050565b6000819050919050565b6100db81610107565b81146100e657600080fd5b50565b6000813590506100f88161011f565b92915050565b600080fd5b61010c81610107565b811461011757600080fd5b5056fea2646970667358221220a1d3d7d0a0d9c23a4c4fb2b0bd4c9d9d6e0773f3941d1b7a6f2d7a3d2b0a9a7d64736f6c63430008140033"

    if plan["tool"] == "CONTRACT_CALL":
        address = st.text_input("Contract address", value=st.session_state.get("storage_addr",""))

    approve = st.checkbox("Approve execution", value=False)
    if st.button("Simulate & Execute"):
        payload = {"plan": plan, "approve": approve}
        if abi: payload["abi"] = abi
        if bytecode: payload["bytecode"] = bytecode
        if address: payload["address"] = address
        data, err = call_backend("POST", "/agent/execute", **payload)
        if err:
            st.error(err)
        else:
            st.json(data)
            # capture deployed address
            if "result" in data and isinstance(data["result"], dict) and "address" in data["result"]:
                st.session_state.storage_addr = data["result"]["address"]
