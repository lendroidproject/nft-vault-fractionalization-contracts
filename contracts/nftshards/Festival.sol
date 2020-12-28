// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IFestival.sol";


/** @title Festival
    @author Lendroid Foundation
    @notice Smart contract representing a NFT shard event
    @dev Audit certificate : Pending
*/

// solhint-disable-next-line indent
abstract contract Festival is IFestival, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address;

    // start and end timestamps (both inclusive) when event is open
    uint256 public startTimestamp;
    uint256 public endTimestamp;
    address payable public fundsWallet;// address where funds are collected
    uint256 public totalWeiContributed;// total Wei contributed
    uint256 public totalCapInWei;// total contribution cap in wei
    uint256 public individualCapInWei;// individual cap in wei
    uint256 public shardPerWeiContributed;// shards distributed per wei contribution
    address[] public contributors;// list of contributors

    struct Contribution {
        uint256 weiContributed;
        bool hasWithdrawn;
    }

    mapping (address => Contribution) public contributions;
    bool public shardIssuanceActivated;
    IERC20 public shardToken;

    /**
    * event for shardToken transfer logging
    * @param beneficiary receiving the shardTokens
    * @param amount of shardTokens given to the beneficiary
    */
    event LogShardsWithdrawn(address beneficiary, uint256 amount);

    /**
     * @notice Constructor function
     * @dev Before calling constructor
     *      A. The following contracts should have been deployed
     *          1. Shard Token
     *          2. Funds Wallet
     *      B. The following information should have been confirmed
     *          1. Event duration (start and end times)
     *          2. Individual and total contribution limits
     *          3. Shard Token price
     */
    constructor(address shardTokenAddress,
        address payable fundsWalletAddress,
        uint256 eventStartTimestamp, uint256 eventEndTimestamp,
        uint256 individualCapWeiAmount, uint256 totalCapWeiAmount,
        uint256 shardPerWeiAmount) {// solhint-disable-line func-visibility
        // input validations
        require(shardTokenAddress.isContract(), "invalid shardTokenAddress");
        require(fundsWalletAddress != address(0), "invalid fundsWalletAddress");
        require(eventStartTimestamp >= block.timestamp);// solhint-disable-line not-rely-on-time
        require(eventEndTimestamp > eventStartTimestamp);
        require(individualCapWeiAmount > 0, "individualCapWeiAmount cannot be zero");
        require(totalCapWeiAmount > 0, "totalCapWeiAmount cannot be zero");
        require(individualCapWeiAmount <= totalCapWeiAmount, "individualCapWeiAmount cannot exceed totalCapWeiAmount");
        require(shardPerWeiAmount > 0, "shardPerWeiAmount cannot be zero");
        // set values
        shardToken = IERC20(shardTokenAddress);
        fundsWallet = fundsWalletAddress;
        startTimestamp = eventStartTimestamp;
        endTimestamp = eventEndTimestamp;
        individualCapInWei = individualCapWeiAmount;
        totalCapInWei = totalCapWeiAmount;
        shardPerWeiContributed = shardPerWeiAmount;
    }

    modifier whileFestivalIsActive() {
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= startTimestamp && block.timestamp <= endTimestamp, "Event is not active");
        _;
    }

    /**
    * @notice Allows changing the individual cap.
    */
    function changeIndividualCapInWei(uint256 individualCapWeiAmount) external override onlyOwner {
        require(individualCapWeiAmount > 0, "Individual cap cannot be zero");
        require(individualCapWeiAmount < totalCapInWei, "Individual cap cannot exceed total cap");
        individualCapInWei = individualCapWeiAmount;
    }

    /**
    * @dev Transfers all Ether held by the contract to the address specified by owner.
    */
    function reclaimEther(address payable beneficiary) external override onlyOwner {
        beneficiary.transfer(address(this).balance);
    }

    /**
    * @dev Allows owner to lock contributions and activate shard issuance.
    */
    function activateIssuance() external override onlyOwner {
        // ensure event has ended
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > endTimestamp, "Cannot enable issuance while event is still active");
        // ensure smart contract has sufficient shard tokens to issue
        require(shardToken.balanceOf(address(this)) >= shardPerWeiContributed.mul(totalWeiContributed),
            "Insufficient shardToken balance");
        // enable shardIssuance
        shardIssuanceActivated = true;
    }

    /**
    * @notice Records contribution per account.
    */
    function contributeWei() external payable override whileFestivalIsActive {
        // validations
        require(!shardIssuanceActivated, "Contributions are no longer accepted");
        require(msg.sender != address(0), "Invalid sender address");
        require(msg.value != 0, "Contribution amount cannot be zero");
        require(totalWeiContributed.add(msg.value) <= totalCapInWei);
        require(contributions[msg.sender].weiContributed.add(msg.value) <= individualCapInWei);
        // if we have not received any WEI from this address until now, then we add this address to contributors list.
        if (contributions[msg.sender].weiContributed == 0) {
            contributors.push(msg.sender);
        }
        contributions[msg.sender].weiContributed = contributions[msg.sender].weiContributed.add(msg.value);
        totalWeiContributed = totalWeiContributed.add(msg.value);
        fundsWallet.transfer(msg.value);
    }

    /**
    * @notice Issues shards to the contributor
    */
    function claimShards() external override {
        // contributions should be locked
        require(shardIssuanceActivated, "Shard issuance has not been activated");
        require(contributions[msg.sender].weiContributed > 0, "Contribution amount is zero");
        require(!contributions[msg.sender].hasWithdrawn, "Contributor has withdrawn shards");
        contributions[msg.sender].hasWithdrawn = true;
        uint256 shardAmount = shardPerWeiContributed.mul(contributions[msg.sender].weiContributed);
        shardToken.safeTransfer(msg.sender, shardAmount);
        // emit notification
        emit LogShardsWithdrawn(msg.sender, shardAmount);
    }
}
