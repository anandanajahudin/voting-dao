// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract MockGovToken {
    function getVotes(address) external pure returns (uint256) {
        return 100;
    }
}
