# 🗳️ Privacy Voting DAO with Semaphore

This project is a privacy-preserving voting system using [Semaphore](https://semaphore.appliedzkp.org/) with Hardhat for local development and testing.

## 📦 Requirements

- Node.js v18+
- Yarn / npm
- [Hardhat](https://hardhat.org/)
- Semaphore circuit files (`semaphore.wasm` & `semaphore.zkey`)

## 📁 Project Structure

project-root/
├── contracts/ # Solidity contracts
│ └── PrivacyVotingDAOv2.sol
├── test/ # Hardhat test files
│ └── PrivacyVoting.test.ts
├── scripts/ # Deployment script
│ └── deploy.ts
├── circuits/ # Semaphore proof artifacts
│ ├── semaphore.wasm
│ └── semaphore.zkey
├── hardhat.config.ts
├── package.json
└── README.md

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
yarn install
# or
npm install
```

### 2. Compile Contracts

```bash
npx hardhat compile
```

### 3. Run Local Hardhat Node

This starts a local Ethereum network:

```bash
npx hardhat node
```

Leave this terminal window open.

### 4. Deploy Contracts Locally

In a new terminal:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

You should see output like:

```bash
Verifier deployed to: 0x...
DAO deployed to: 0x...
```

### 5. Run Tests

```bash
npx hardhat test
```

### 🧪 Test Explanation

- Generates an identity and Merkle group
- Deploys contracts with the group root
- Creates a proposal
- Generates Semaphore proof using:
  semaphore.wasm
  semaphore.zkey

- Casts an anonymous vote
- Asserts that the vote tally is correct

### 🛠 Notes

- If you encounter file path errors, ensure the circuits/semaphore.wasm and circuits/semaphore.zkey files exist.
- Ensure the Merkle tree depth in the proof generation matches the circuit compilation.
