// SPDX-License-Identifier: Public Domain
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./SemaphoreVerifier.sol"; // Assuming SemaphoreVerifier.sol is in the same directory or correctly pathed

interface IERC20Votes {
    function getVotes(address account) external view returns (uint256);
}

enum CountingMode {
    Simple,
    Quadratic
}

contract PrivacyVotingDAOv2 is Ownable {
    /* ---------- Constructor ---------- */
    constructor(
        SemaphoreVerifier _verifier,
        uint256 _root, // <--- UBAH KE uint256
        IERC20Votes _govToken
    ) Ownable(msg.sender) {
        verifier = _verifier;
        memberMerkleRoot = _root; // Pastikan tipe memberMerkleRoot juga uint256
        govToken = _govToken;
    }

    /* ---------- Data Types ---------- */
    struct Proposal {
        string title;
        string description;
        CountingMode mode; // simple (1 per identity) or quadratic
        string[] options;
        mapping(uint256 => uint256) tally; // option => votes
        mapping(uint256 => bool) nullifiers; // seen nullifiers
        uint64 closes; // unix time when voting ends
        bool closed;
    }
    /* ---------- Storage ---------- */
    uint256 public memberMerkleRoot; // <--- UBAH KE uint256
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    SemaphoreVerifier public immutable verifier;
    IERC20Votes public immutable govToken; // optional ERC20Votes used for quadratic weight
    /* ---------- Events ---------- */
    event MemberRootUpdated(uint256 newRoot); // <--- UBAH KE uint256 (jika perlu konsisten)
    event ProposalCreated(
        uint256 indexed id,
        CountingMode mode,
        string title,
        uint64 closes
    );
    event VoteCast(
        uint256 indexed id,
        uint8 option,
        uint256 nullifier,
        uint256 weight
    );
    event ProposalClosed(uint256 indexed id, uint8 winner);

    /* ---------- Owner-only ---------- */
    function updateMemberRoot(uint256 newRoot) external onlyOwner {
        // <--- UBAH KE uint256
        memberMerkleRoot = newRoot;
        emit MemberRootUpdated(newRoot);
    }

    function createProposal(
        string calldata title,
        string calldata description,
        CountingMode mode,
        string[] calldata options,
        uint32 duration /* seconds */
    ) external onlyOwner returns (uint256 id) {
        require(options.length >= 2, "need 2+ opts");
        id = ++proposalCount;
        Proposal storage p = _proposals[id];
        p.title = title;
        p.description = description;
        p.mode = mode;

        delete p.options;
        for (uint i = 0; i < options.length; i++) {
            p.options.push(options[i]);
        }

        p.closes = uint64(block.timestamp) + duration;
        emit ProposalCreated(id, mode, title, p.closes);
    }

    function closeProposal(uint256 id) public {
        Proposal storage p = _proposals[id];
        require(!p.closed, "already closed");
        require(block.timestamp >= p.closes, "not expired");
        p.closed = true;
        uint8 winner = type(uint8).max;
        uint256 high = 0;
        for (uint8 i = 0; i < p.options.length; ++i) {
            uint256 v = p.tally[i];
            if (v > high) {
                high = v;
                winner = i;
            } else if (v == high) {
                winner = type(uint8).max;
            }
        }
        emit ProposalClosed(id, winner);
    }

    /* ---------- Voting ---------- */
    function vote(
        uint256 id,
        uint8 option,
        uint256 signalHash, // <-- Terima signal hash dari klien
        uint256 nullifierHash, // <-- Nama parameter yang jelas
        uint256 merkleRoot, // <-- Nama parameter yang jelas
        uint256[8] calldata proof
    ) external {
        Proposal storage p = _proposals[id];
        require(block.timestamp < p.closes, "voting is closed");
        require(option < p.options.length, "invalid option");
        require(!p.nullifiers[nullifierHash], "vote already cast");
        require(merkleRoot == memberMerkleRoot, "invalid merkle root");

        // Periksa apakah signalHash yang diberikan cocok dengan opsi vote yang diklaim.
        // Ini adalah cara on-chain untuk memvalidasi bahwa sinyal tersebut benar untuk vote ini.
        bytes32 expectedSignalHash = keccak256(
            abi.encodePacked("VOTE_", _toString(option))
        );
        require(
            signalHash == uint256(expectedSignalHash),
            "signal-option mismatch"
        );

        // Verifikasi bukti dengan Semaphore Verifier
        // Di sini, kita asumsikan verifier Anda memiliki interface standar Groth16.
        // Verifikasi bukti dengan Semaphore Verifier (Groth16)

        // Susun sinyal publik sesuai urutan yang diharapkan oleh sirkuit Semaphore
        // Urutan standar: root, nullifierHash, signalHash, externalNullifier
        uint256[4] memory publicSignals = [
            merkleRoot,
            nullifierHash,
            signalHash,
            id // 'id' proposal berfungsi sebagai externalNullifier
        ];

        require(verifier.verifyProof(proof, publicSignals), "invalid proof");

        p.nullifiers[nullifierHash] = true;

        uint256 weight = 1;
        if (
            p.mode == CountingMode.Quadratic && address(govToken) != address(0)
        ) {
            uint256 raw = govToken.getVotes(msg.sender);
            weight = sqrt(raw);
        }

        unchecked {
            p.tally[option] += weight;
        }

        emit VoteCast(id, option, nullifierHash, weight);

        if (block.timestamp >= p.closes && !p.closed) {
            closeProposal(id);
        }
    }

    /* ---------- Reads ---------- */
    function getProposal(
        uint256 id
    )
        external
        view
        returns (
            string memory title,
            CountingMode mode,
            bool open,
            uint64 closes,
            string[] memory options
        )
    {
        Proposal storage p = _proposals[id];
        return (
            p.title,
            p.mode,
            !p.closed && block.timestamp < p.closes,
            p.closes,
            p.options
        );
    }

    function tallies(
        uint256 id,
        uint16 start,
        uint16 n
    ) external view returns (uint256[] memory out) {
        Proposal storage p = _proposals[id];
        uint16 len = uint16(p.options.length);
        require(start < len, "oob");
        uint16 end = (n == 0 || start + n > len || start + n < start)
            ? len
            : start + n;
        if (start >= end && len > 0) {
            out = new uint256[](0);
            return out;
        }
        out = new uint256[](end - start);
        for (uint16 i = start; i < end; ++i) {
            out[i - start] = p.tally[i];
        }
    }

    /* ---------- Internal ---------- */
    function sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
