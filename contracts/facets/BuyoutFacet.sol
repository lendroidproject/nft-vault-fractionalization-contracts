// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "../libraries/LibAppStorage.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IBuyout.sol";


/** @title BuyoutFacet
    @author Lendroid Foundation
    @notice Smart contract representing a NFT bundle buyout
    @dev Audit certificate : Pending
*/
contract BuyoutFacet is LibAppStorageModifiers, IBuyout {
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using SafeMath for uint256;
    using Address for address;

    // Events that will be emitted on changes.
    event HighestBidIncreased(address bidder, uint256 amount);
    event BuyoutStarted(address bidder, uint256 amount);
    event BuyoutRevoked(uint256 amount);
    event BuyoutEnded(address bidder, uint256 amount);

    modifier whileBuyoutIsActive() {
        require((
            (app.buyoutStatus == BuyoutStatus.ACTIVE) &&
            (block.timestamp >= app.buyoutStart) &&// solhint-disable-line not-rely-on-time
            (block.timestamp <= buyoutEnd())// solhint-disable-line not-rely-on-time
        ), "Buyout is not active");
        _;
    }

    /**
     * @notice Configuration function
     * @dev Before calling constructor
     *      A. The following contracts should have been deployed
     *          1. token0 Token
     *          2. Buyout Token
     *      B. The following information should have been confirmed
     *          1. Minimum threshold of token0 Tokens + Buyout Tokens to initiate a buyout process
     *          2. Duration of a buyout process
     *          3. Minimum threshold of token0 Tokens to revoke a buyout process
     * @param token2Address : address of Buyout Token
     * @param uint256Values : uint256 array [buyoutThreshold,
           buyoutDuration, buyoutStopThreshold]
     */
    function enableBuyout(address token2Address,
        uint256[3] memory uint256Values) external override onlyOwner {
        // input validations
        require(token2Address.isContract(), "{enableBuyout} : invalid token2Address");
        require(uint256Values[0] > 0, "{enableBuyout} : buyoutThreshold cannot be zero");
        require(uint256Values[1] > 0, "{enableBuyout} : buyoutDuration cannot be zero");
        require(uint256Values[2] > 0, "{enableBuyout} : buyoutStopThreshold cannot be zero");
        // verify app has been configured
        require(app.mode == AppMode.MARKET_CREATED &&
            app.marketStatus == MarketStatus.CLOSED,
            "{enableBuyout} : app mode is not MARKET_CREATED__CLOSED");
        app.mode = AppMode.BUYOUT_ENABLED;
        // set values
        app.token2 = IERC20(token2Address);
        app.buyoutThreshold = uint256Values[0];
        app.buyoutDuration = uint256Values[1];
        app.buyoutStopThreshold = uint256Values[2];
        app.buyoutStatus == BuyoutStatus.CONFIGURED;
    }

    function endBuyout() external override {
        require(app.mode == AppMode.BUYOUT_ENABLED, "{endBuyout} : app mode is not BUYOUT_ENABLED");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= buyoutEnd(), "Buyout has not yet ended");
        require(app.buyoutStatus != BuyoutStatus.ENDED, "Buyout has already ended");
        require(app.highestBidder != address(0), "Buyout does not have highestBidder");
        // additional safety checks
        require((
            (app.bidDeposits[app.highestBidder].token0Amount > 0) ||
            (app.bidDeposits[app.highestBidder].token2Amount > 0)
        ), "highestBidder deposits cannot be 0");
        // set status
        app.buyoutStatus = BuyoutStatus.ENDED;
        // burn token0Amount
        if (app.bidDeposits[app.highestBidder].token0Amount > 0) {
            app.token0.burn(app.bidDeposits[app.highestBidder].token0Amount);
        }

        emit BuyoutEnded(app.highestBidder, app.highestBid);
    }

    function placeBid(uint256 totalBidAmount, uint256 token2Amount) external override {
        require(app.mode == AppMode.BUYOUT_ENABLED, "{placeBid} : app mode is not BUYOUT_ENABLED");
        // verify buyout has not ended
        require(app.buyoutStatus != BuyoutStatus.ENDED, "Buyout has ended");
        // activate buyout process if applicable
        if ((app.buyoutStatus == BuyoutStatus.CONFIGURED) || (app.buyoutStatus == BuyoutStatus.REVOKED)) {
            _startBuyout();
        }
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp <= buyoutEnd(), "Buyout has ended");
        require(totalBidAmount > app.buyoutThreshold, "totalBidAmount does not meet minimum threshold");
        require(totalBidAmount > app.highestBid, "There already is a higher bid");
        require(app.token2.balanceOf(msg.sender) >= token2Amount);
        uint256 token0Amount = requiredToken0ToBid(token2Amount);
        require(app.token2.balanceOf(msg.sender) >= token2Amount);
        // return highest bid to previous bidder
        if (app.highestBid > 0) {
            _setPendingBidWithdrawals(app.highestBidder);
        }
        // set sender as highestBidder and totalBidAmount as highestBid
        app.highestBidder = msg.sender;
        app.highestBid = totalBidAmount;
        app.bidDeposits[msg.sender].token0Amount = token0Amount;
        app.bidDeposits[msg.sender].token2Amount = token2Amount;
        // transfer token0 and token2 to this contract
        app.token0.safeTransferFrom(msg.sender, address(this), token0Amount);
        app.token2.safeTransferFrom(msg.sender, address(this), token2Amount);
        // send notification
        emit HighestBidIncreased(msg.sender, totalBidAmount);
    }

    function withdrawBid() external override {
        require(app.mode == AppMode.BUYOUT_ENABLED, "{withdrawBid} : app mode is not BUYOUT_ENABLED");
        if (msg.sender == app.highestBidder) {
            require(((app.buyoutStatus == BuyoutStatus.CONFIGURED) || (app.buyoutStatus == BuyoutStatus.REVOKED)),
                "highest bidder cannot withdraw bid");
        }
        // get sender balances of token0 and token2
        uint256 token0Amount = app.pendingBidWithdrawals[msg.sender].token0Amount;
        uint256 token2Amount = app.pendingBidWithdrawals[msg.sender].token2Amount;
        require(((token0Amount > 0) || (token2Amount > 0)), "No pending withdrawals");
        if (token0Amount > 0) {
            app.pendingBidWithdrawals[msg.sender].token0Amount = 0;
            app.token0.safeTransfer(msg.sender, token0Amount);
        }
        if (token2Amount > 0) {
            app.pendingBidWithdrawals[msg.sender].token2Amount = 0;
            app.token2.safeTransfer(msg.sender, token2Amount);
        }
    }

    function stakeToken0ToStopBuyout(uint256 token0Amount) external override whileBuyoutIsActive {
        require(app.mode == AppMode.BUYOUT_ENABLED, "{stakeToken0ToStopBuyout} : app mode is not BUYOUT_ENABLED");
        uint256 updatedTotalToken0Staked = app.totalToken0Staked.add(token0Amount);
        if (updatedTotalToken0Staked >= app.buyoutStopThreshold) {
            _setPendingBidWithdrawals(app.highestBidder);
            // set status
            app.buyoutStatus = BuyoutStatus.REVOKED;
            emit BuyoutRevoked(updatedTotalToken0Staked);
        }
        app.buyoutStopStakes[msg.sender].token0Amount =
            app.buyoutStopStakes[msg.sender].token0Amount.add(token0Amount);
        app.totalToken0Staked = updatedTotalToken0Staked;
        app.token0.safeTransferFrom(msg.sender, address(this), token0Amount);
    }

    function withdrawStakedToken0() external override {
        require(app.mode == AppMode.BUYOUT_ENABLED, "{withdrawStakedToken0} : app mode is not BUYOUT_ENABLED");
        uint256 token0Amount = app.buyoutStopStakes[msg.sender].token0Amount;
        require(token0Amount > 0, "No staked amount");
        app.buyoutStopStakes[msg.sender].token0Amount = 0;
        app.totalToken0Staked = app.totalToken0Staked.sub(token0Amount);
        app.token0.safeTransfer(msg.sender, token0Amount);
    }

    function token2() external view override returns (address) {
        return address(app.token2);
    }

    function buyoutThreshold() external view override returns (uint256) {
        return app.buyoutThreshold;
    }

    function buyoutDuration() external view override returns (uint256) {
        return app.buyoutDuration;
    }

    function buyoutStart() external view override returns (uint256) {
        return app.buyoutStart;
    }

    function buyoutStopThreshold() external view override returns (uint256) {
        return app.buyoutStopThreshold;
    }

    function totalToken0Staked() external view override returns (uint256) {
        return app.totalToken0Staked;
    }

    function buyoutStopStakes(address staker) external view override returns (uint256 token0Amount) {
        token0Amount = app.buyoutStopStakes[staker].token0Amount;
    }

    function highestBidder() external view override returns (address) {
        return app.highestBidder;
    }

    function highestBid() external view override returns (uint256) {
        return app.highestBid;
    }

    function bidDeposits(address bidder) external view override returns (uint256 token0Amount, uint256 token2Amount) {
        token0Amount = app.bidDeposits[bidder].token0Amount;
        token2Amount = app.bidDeposits[bidder].token2Amount;
    }

    function pendingBidWithdrawals(address bidder) external view override returns (uint256 token0Amount,
            uint256 token2Amount) {
        token0Amount = app.pendingBidWithdrawals[bidder].token0Amount;
        token2Amount = app.pendingBidWithdrawals[bidder].token2Amount;
    }

    function buyoutEnd() public view override returns (uint256) {
        return app.buyoutStart.add(app.buyoutDuration);
    }

    function requiredToken0ToBid(uint256 token2Amount) public view override returns (uint256) {
        uint256 token0Supply = app.token0.totalSupply();
        uint256 threshold = app.highestBid >= app.buyoutThreshold ? app.highestBid : app.buyoutThreshold;
        require(token2Amount <= threshold, "token2Amount cannot exceed threshold");
        // threshold * ( (totalSupply - userBalance) / totalSupply )
        return token0Supply
            .mul(
                threshold
                .sub(token2Amount)
            ).div(threshold);
    }

    function _startBuyout() internal {
        app.buyoutStatus == BuyoutStatus.ACTIVE;
        // reset values
        app.highestBid = 0;
        app.highestBidder = address(0);
        // set buyoutStart
        app.buyoutStart = block.timestamp;// solhint-disable-line not-rely-on-time
    }

    function _setPendingBidWithdrawals(address bidder) internal {
        app.pendingBidWithdrawals[bidder].token0Amount =
            app.pendingBidWithdrawals[bidder].token0Amount.add(
                app.bidDeposits[bidder].token0Amount
            );
        app.pendingBidWithdrawals[bidder].token2Amount =
            app.pendingBidWithdrawals[bidder].token2Amount.add(
                app.bidDeposits[bidder].token2Amount
            );
        app.bidDeposits[bidder].token0Amount = 0;
        app.bidDeposits[bidder].token2Amount = 0;
    }

}
