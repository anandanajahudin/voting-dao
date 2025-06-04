import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
  version: "0.8.28",
  settings: { optimizer: { enabled: true, runs: 10_000 } },
  },
  networks: {
    optimism: {
      url: process.env.RPC_OPTIMISM,
      accounts: [process.env.DEPLOYER_PK!],
    },
  },
};
export default config;