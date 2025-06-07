// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract MockVerifier {
    function verifyProof(
        uint256[8] calldata,
        uint256[4] calldata
    ) external pure returns (bool) {
        return true;
    }
}
