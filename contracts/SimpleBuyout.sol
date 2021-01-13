// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IToken0.sol";


/** @title SimpleBuyout
    @author Lendroid Foundation
    @notice Smart contract representing a NFT bundle buyout
    @dev Audit certificate : Pending
*/
contract SimpleBuyout is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using SafeMath for uint256;
    using Address for address;

    enum BuyoutStatus { ENABLED, ACTIVE, REVOKED, ENDED }

    struct BidDeposit {
        uint256 token0Amount;
        uint256 token2Amount;
    }

    struct PendingBidWithdrawal {
        uint256 token0Amount;
        uint256 token2Amount;
    }

    struct BuyoutStopStake {
        uint256 token0Amount;
    }

    BuyoutStatus public status;
    IToken0 public token0;
    //// admin
    IERC20 public token2;
    uint256 public startThreshold;
    uint256 public duration;
    uint256 public startTimestamp;
    //// governance
    uint256 public stopThreshold;
    uint256 public totalToken0Staked;
    mapping (address => BuyoutStopStake) public stopStakes;
    //// end user
    address public highestBidder;
    uint256 public highestBid;
    mapping (address => BidDeposit) public bidDeposits;
    mapping (address => PendingBidWithdrawal) public pendingBidWithdrawals;

    // Events that will be emitted on changes.
    event HighestBidIncreased(address bidder, uint256 amount);
    event BuyoutStarted(address bidder, uint256 amount);
    event BuyoutRevoked(uint256 amount);
    event BuyoutEnded(address bidder, uint256 amount);

    function enableBuyout(address token0Address, address token2Address,
        uint256[3] memory uint256Values) external onlyOwner {
        // input validations
        require(token0Address.isContract(), "{enableBuyout} : invalid token0Address");
        require(token2Address.isContract(), "{enableBuyout} : invalid token2Address");
        require(uint256Values[0] > 0, "{enableBuyout} : startThreshold cannot be zero");
        require(uint256Values[1] > 0, "{enableBuyout} : duration cannot be zero");
        require(uint256Values[2] > 0, "{enableBuyout} : stopThreshold cannot be zero");
        // set values
        token0 = IToken0(token0Address);
        token2 = IERC20(token2Address);
        startThreshold = uint256Values[0];
        duration = uint256Values[1];
        stopThreshold = uint256Values[2];
        status == BuyoutStatus.ENABLED;
    }

    function endBuyout() external {
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= endTimestamp(), "{endBuyout} : buyout has not yet ended");
        require(status != BuyoutStatus.ENDED, "{endBuyout} : buyout has already ended");
        require(highestBidder != address(0), "{endBuyout} : buyout does not have highestBidder");
        // additional safety checks
        require((
            (bidDeposits[highestBidder].token0Amount > 0) ||
            (bidDeposits[highestBidder].token2Amount > 0)
        ), "{endBuyout} : highestBidder deposits cannot be 0");
        // set status
        status = BuyoutStatus.ENDED;
        // burn token0Amount
        if (bidDeposits[highestBidder].token0Amount > 0) {
            token0.burn(bidDeposits[highestBidder].token0Amount);
        }

        emit BuyoutEnded(highestBidder, highestBid);
    }

    function placeBid(uint256 totalBidAmount, uint256 token2Amount) external {
        // verify buyout has not ended
        require(status != BuyoutStatus.ENDED, "{placeBid} : buyout has ended");
        // activate buyout process if applicable
        if ((status == BuyoutStatus.ENABLED) || (status == BuyoutStatus.REVOKED)) {
            _activateBuyout();
        }
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp <= endTimestamp(), "{placeBid} : buyout has ended");
        require(totalBidAmount > startThreshold, "{placeBid} : totalBidAmount does not meet minimum threshold");
        require(totalBidAmount > highestBid, "{placeBid} : there already is a higher bid");
        require(token2.balanceOf(msg.sender) >= token2Amount);
        uint256 token0Amount = requiredToken0ToBid(token2Amount);
        require(token2.balanceOf(msg.sender) >= token2Amount);
        // return highest bid to previous bidder
        if (highestBid > 0) {
            _setPendingBidWithdrawals(highestBidder);
        }
        // set sender as highestBidder and totalBidAmount as highestBid
        highestBidder = msg.sender;
        highestBid = totalBidAmount;
        bidDeposits[msg.sender].token0Amount = token0Amount;
        bidDeposits[msg.sender].token2Amount = token2Amount;
        // transfer token0 and token2 to this contract
        token0.safeTransferFrom(msg.sender, address(this), token0Amount);
        token2.safeTransferFrom(msg.sender, address(this), token2Amount);
        // send notification
        emit HighestBidIncreased(msg.sender, totalBidAmount);
    }

    function withdrawBid() external {
        // verify buyout has not ended
        require(status != BuyoutStatus.ENDED, "{placeBid} : buyout has ended");
        if (msg.sender == highestBidder) {
            require(((status == BuyoutStatus.ENABLED) || (status == BuyoutStatus.REVOKED)),
                "{withdrawBid} : highest bidder cannot withdraw bid");
        }
        // get sender balances of token0 and token2
        uint256 token0Amount = pendingBidWithdrawals[msg.sender].token0Amount;
        uint256 token2Amount = pendingBidWithdrawals[msg.sender].token2Amount;
        require(((token0Amount > 0) || (token2Amount > 0)), "{withdrawBid} : no pending withdrawals");
        if (token0Amount > 0) {
            pendingBidWithdrawals[msg.sender].token0Amount = 0;
            token0.safeTransfer(msg.sender, token0Amount);
        }
        if (token2Amount > 0) {
            pendingBidWithdrawals[msg.sender].token2Amount = 0;
            token2.safeTransfer(msg.sender, token2Amount);
        }
    }

    function stakeToken0ToStopBuyout(uint256 token0Amount) external {
        // verify buyout has not ended
        require((
            (status == BuyoutStatus.ACTIVE) &&
            (block.timestamp >= startTimestamp) &&// solhint-disable-line not-rely-on-time
            (block.timestamp <= endTimestamp())// solhint-disable-line not-rely-on-time
        ), "{stakeToken0ToStopBuyout} : Buyout is not active");
        uint256 updatedTotalToken0Staked = totalToken0Staked.add(token0Amount);
        if (updatedTotalToken0Staked >= stopThreshold) {
            _setPendingBidWithdrawals(highestBidder);
            // set status
            status = BuyoutStatus.REVOKED;
            emit BuyoutRevoked(updatedTotalToken0Staked);
        }
        stopStakes[msg.sender].token0Amount =
            stopStakes[msg.sender].token0Amount.add(token0Amount);
        totalToken0Staked = updatedTotalToken0Staked;
        token0.safeTransferFrom(msg.sender, address(this), token0Amount);
    }

    function withdrawStakedToken0() external {
        uint256 token0Amount = stopStakes[msg.sender].token0Amount;
        require(token0Amount > 0, "{withdrawStakedToken0} : no staked token0Amount");
        stopStakes[msg.sender].token0Amount = 0;
        totalToken0Staked = totalToken0Staked.sub(token0Amount);
        token0.safeTransfer(msg.sender, token0Amount);
    }

    function endTimestamp() public view returns (uint256) {
        return startTimestamp.add(duration);
    }

    function requiredToken0ToBid(uint256 token2Amount) public view returns (uint256) {
        uint256 token0Supply = token0.totalSupply();
        uint256 threshold = highestBid >= startThreshold ? highestBid : startThreshold;
        require(token2Amount <= threshold, "{requiredToken0ToBid} : token2Amount cannot exceed threshold");
        // threshold * ( (totalSupply - userBalance) / totalSupply )
        return token0Supply
            .mul(
                threshold
                .sub(token2Amount)
            ).div(threshold);
    }

    function _activateBuyout() internal {
        status == BuyoutStatus.ACTIVE;
        // reset values
        highestBid = 0;
        highestBidder = address(0);
        // set startTimestamp
        startTimestamp = block.timestamp;// solhint-disable-line not-rely-on-time
    }

    function _setPendingBidWithdrawals(address bidder) internal {
        pendingBidWithdrawals[bidder].token0Amount =
            pendingBidWithdrawals[bidder].token0Amount.add(
                bidDeposits[bidder].token0Amount
            );
        pendingBidWithdrawals[bidder].token2Amount =
            pendingBidWithdrawals[bidder].token2Amount.add(
                bidDeposits[bidder].token2Amount
            );
        bidDeposits[bidder].token0Amount = 0;
        bidDeposits[bidder].token2Amount = 0;
    }

}
