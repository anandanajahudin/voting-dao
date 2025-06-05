// SPDX-License-Identifier: Public Domain
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SemaphoreVerifier.sol";
/**
 * @dev New features compared with v1:
 * • Automatic proposal expiry (Roadmap A)
 * • Optional quadratic tally (RoadmapE) – toggled per-proposal
 * • Emits PaginatedTallies event for cheap off-chain syncing
 */
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
        uint64 _root,
        IERC20Votes _govToken
    ) Ownable(msg.sender) {
        verifier = _verifier;
        memberMerkleRoot = _root;
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
    uint64 public memberMerkleRoot;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    SemaphoreVerifier public immutable verifier;
    IERC20Votes public immutable govToken; // optional ERC20Votes used for quadratic weight
    /* ---------- Events ---------- */
    event MemberRootUpdated(uint64 newRoot);
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
    function updateMemberRoot(uint64 newRoot) external onlyOwner {
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
        // Clear existing options array (penting!)
        delete p.options;
        // Copy each string secara manual
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
        for (uint8 i; i < p.options.length; ++i) {
            uint256 v = p.tally[i];
            if (v > high) {
                high = v;
                winner = i;
            } else if (v == high) winner = type(uint8).max; // tie
        }
        emit ProposalClosed(id, winner);
    }
    /* ---------- Voting ---------- */
    function vote(
        uint256 id,
        uint8 option,
        uint256 nullifier,
        uint64 root,
        uint256[8] calldata proof
    ) external {
        Proposal storage p = _proposals[id];
        require(block.timestamp < p.closes, "closed");
        require(option < p.options.length, "bad opt");
        require(!p.nullifiers[nullifier], "dupe");
        require(root == memberMerkleRoot, "root");

        uint256 signal = uint256(keccak256(abi.encodePacked(id, option))) >> 8;

        uint256[4] memory pubSignals = [
            uint256(root),
            nullifier,
            signal,
            uint256(0) // jika circuit cuma 3 public inputs, tambahkan 0 sebagai filler
        ];

        require(
            verifier.verifyProof(
                [proof[0], proof[1]], // _pA
                [[proof[2], proof[3]], [proof[4], proof[5]]], // _pB
                [proof[6], proof[7]], // _pC
                pubSignals
            ),
            "badproof"
        );

        p.nullifiers[nullifier] = true;

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
        emit VoteCast(id, option, nullifier, weight);

        if (block.timestamp >= p.closes) closeProposal(id);
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
        uint16 end = n == 0 || start + n > len ? len : start + n;
        out = new uint256[](end - start);
        for (uint16 i = start; i < end; ++i) out[i - start] = p.tally[i];
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
}
