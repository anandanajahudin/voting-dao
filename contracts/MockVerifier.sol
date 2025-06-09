// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract MockVerifier {
    bool private _shouldVerify;

    constructor(bool shouldVerify) {
        _shouldVerify = shouldVerify;
    }

    function verifyProof(
        uint256[8] calldata,
        uint256[4] calldata
    ) external view returns (bool) {
        return _shouldVerify;
    }
}
