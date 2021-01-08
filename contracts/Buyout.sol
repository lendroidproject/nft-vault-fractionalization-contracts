// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IBuyout.sol";
import "./interfaces/IToken0.sol";


/** @title Buyout
    @author Lendroid Foundation
    @notice Smart contract representing a NFT bundle buyout
    @dev Audit certificate : Pending
*/
contract Buyout is IBuyout, Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using SafeMath for uint256;
    using Address for address;

    enum AppMode { MARKET_CREATED, BUYOUT_ENABLED }

    enum BuyoutStatus { CONFIGURED, ACTIVE, REVOKED, ENDED }

    enum MarketStatus { CLOSED }

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

    AppMode public mode;
    MarketStatus public marketStatus;
    BuyoutStatus public buyoutStatus;
    IToken0 public token0;
    //// admin
    IERC20 public token2;
    uint256 public buyoutThreshold;
    uint256 public buyoutDuration;
    uint256 public buyoutStart;
    //// governance
    uint256 public buyoutStopThreshold;
    uint256 public totalToken0Staked;
    mapping (address => BuyoutStopStake) public buyoutStopStakes;
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

    modifier whileBuyoutIsActive() {
        require((
            (buyoutStatus == BuyoutStatus.ACTIVE) &&
            (block.timestamp >= buyoutStart) &&// solhint-disable-line not-rely-on-time
            (block.timestamp <= buyoutEnd())// solhint-disable-line not-rely-on-time
        ), "Buyout is not active");
        _;
    }

    function enableBuyout(address token0Address, address token2Address,
        uint256[3] memory uint256Values) external override onlyOwner {
        // input validations
        require(token0Address.isContract(), "{enableBuyout} : invalid token0Address");
        require(token2Address.isContract(), "{enableBuyout} : invalid token2Address");
        require(uint256Values[0] > 0, "{enableBuyout} : buyoutThreshold cannot be zero");
        require(uint256Values[1] > 0, "{enableBuyout} : buyoutDuration cannot be zero");
        require(uint256Values[2] > 0, "{enableBuyout} : buyoutStopThreshold cannot be zero");
        // verify app has been configured
        require(mode == AppMode.MARKET_CREATED &&
            marketStatus == MarketStatus.CLOSED,
            "{enableBuyout} : app mode is not MARKET_CREATED__CLOSED");
        mode = AppMode.BUYOUT_ENABLED;
        // set values
        token0 = IToken0(token0Address);
        token2 = IERC20(token2Address);
        buyoutThreshold = uint256Values[0];
        buyoutDuration = uint256Values[1];
        buyoutStopThreshold = uint256Values[2];
        buyoutStatus == BuyoutStatus.CONFIGURED;
    }

    function endBuyout() external override {
        require(mode == AppMode.BUYOUT_ENABLED, "{endBuyout} : app mode is not BUYOUT_ENABLED");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= buyoutEnd(), "Buyout has not yet ended");
        require(buyoutStatus != BuyoutStatus.ENDED, "Buyout has already ended");
        require(highestBidder != address(0), "Buyout does not have highestBidder");
        // additional safety checks
        require((
            (bidDeposits[highestBidder].token0Amount > 0) ||
            (bidDeposits[highestBidder].token2Amount > 0)
        ), "highestBidder deposits cannot be 0");
        // set status
        buyoutStatus = BuyoutStatus.ENDED;
        // burn token0Amount
        if (bidDeposits[highestBidder].token0Amount > 0) {
            token0.burn(bidDeposits[highestBidder].token0Amount);
        }

        emit BuyoutEnded(highestBidder, highestBid);
    }

    function placeBid(uint256 totalBidAmount, uint256 token2Amount) external override {
        require(mode == AppMode.BUYOUT_ENABLED, "{placeBid} : app mode is not BUYOUT_ENABLED");
        // verify buyout has not ended
        require(buyoutStatus != BuyoutStatus.ENDED, "Buyout has ended");
        // activate buyout process if applicable
        if ((buyoutStatus == BuyoutStatus.CONFIGURED) || (buyoutStatus == BuyoutStatus.REVOKED)) {
            _startBuyout();
        }
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp <= buyoutEnd(), "Buyout has ended");
        require(totalBidAmount > buyoutThreshold, "totalBidAmount does not meet minimum threshold");
        require(totalBidAmount > highestBid, "There already is a higher bid");
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

    function withdrawBid() external override {
        require(mode == AppMode.BUYOUT_ENABLED, "{withdrawBid} : app mode is not BUYOUT_ENABLED");
        if (msg.sender == highestBidder) {
            require(((buyoutStatus == BuyoutStatus.CONFIGURED) || (buyoutStatus == BuyoutStatus.REVOKED)),
                "highest bidder cannot withdraw bid");
        }
        // get sender balances of token0 and token2
        uint256 token0Amount = pendingBidWithdrawals[msg.sender].token0Amount;
        uint256 token2Amount = pendingBidWithdrawals[msg.sender].token2Amount;
        require(((token0Amount > 0) || (token2Amount > 0)), "No pending withdrawals");
        if (token0Amount > 0) {
            pendingBidWithdrawals[msg.sender].token0Amount = 0;
            token0.safeTransfer(msg.sender, token0Amount);
        }
        if (token2Amount > 0) {
            pendingBidWithdrawals[msg.sender].token2Amount = 0;
            token2.safeTransfer(msg.sender, token2Amount);
        }
    }

    function stakeToken0ToStopBuyout(uint256 token0Amount) external override whileBuyoutIsActive {
        require(mode == AppMode.BUYOUT_ENABLED, "{stakeToken0ToStopBuyout} : app mode is not BUYOUT_ENABLED");
        uint256 updatedTotalToken0Staked = totalToken0Staked.add(token0Amount);
        if (updatedTotalToken0Staked >= buyoutStopThreshold) {
            _setPendingBidWithdrawals(highestBidder);
            // set status
            buyoutStatus = BuyoutStatus.REVOKED;
            emit BuyoutRevoked(updatedTotalToken0Staked);
        }
        buyoutStopStakes[msg.sender].token0Amount =
            buyoutStopStakes[msg.sender].token0Amount.add(token0Amount);
        totalToken0Staked = updatedTotalToken0Staked;
        token0.safeTransferFrom(msg.sender, address(this), token0Amount);
    }

    function withdrawStakedToken0() external override {
        require(mode == AppMode.BUYOUT_ENABLED, "{withdrawStakedToken0} : app mode is not BUYOUT_ENABLED");
        uint256 token0Amount = buyoutStopStakes[msg.sender].token0Amount;
        require(token0Amount > 0, "No staked amount");
        buyoutStopStakes[msg.sender].token0Amount = 0;
        totalToken0Staked = totalToken0Staked.sub(token0Amount);
        token0.safeTransfer(msg.sender, token0Amount);
    }

    function buyoutEnd() public view override returns (uint256) {
        return buyoutStart.add(buyoutDuration);
    }

    function requiredToken0ToBid(uint256 token2Amount) public view override returns (uint256) {
        uint256 token0Supply = token0.totalSupply();
        uint256 threshold = highestBid >= buyoutThreshold ? highestBid : buyoutThreshold;
        require(token2Amount <= threshold, "token2Amount cannot exceed threshold");
        // threshold * ( (totalSupply - userBalance) / totalSupply )
        return token0Supply
            .mul(
                threshold
                .sub(token2Amount)
            ).div(threshold);
    }

    function _startBuyout() internal {
        buyoutStatus == BuyoutStatus.ACTIVE;
        // reset values
        highestBid = 0;
        highestBidder = address(0);
        // set buyoutStart
        buyoutStart = block.timestamp;// solhint-disable-line not-rely-on-time
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
