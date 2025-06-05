import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { viaIR:true, optimizer: { enabled: true, runs: 10_000 } },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    // optimism: {
    //   url: process.env.RPC_OPTIMISM,
    //   accounts: [process.env.DEPLOYER_PK!],
    // },
  },
};
export default config;