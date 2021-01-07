// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "../libraries/LibAppStorage.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IMarket.sol";


/** @title MarketFacet
    @author Lendroid Foundation
    @notice Smart contract representing token0 market
    @dev Audit certificate : Pending
*/
contract MarketFacet is LibAppStorageModifiers, IMarket {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using Address for address;

    event PaymentReceived(address contributor, uint256 amount);

    event Token0Withdrawn(address beneficiary, uint256 amount);

    event Token1Withdrawn(address beneficiary, uint256 amount);

    modifier whileIsActive() {
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= app.marketStart && block.timestamp <= app.marketEnd, "Event is not active");
        _;
    }

    /**
     * @notice Configuration function
     * @dev Before calling this function
     *      A. The following contracts should have been deployed
     *          1. token0
     *          2. token1
     *          3. Funds Wallet
     *      B. The following information should have been confirmed
     *          1. Event duration (start and end times)
     *          2. Individual and total Payment limits
     *          3. token0 price
     * @param fundsWalletAddress : Address that collects funds from token0 token purchase
     * @param uint256Values : uint256 array [marketStart, marketEnd,
           individualCap, totalCap, token0PerToken1]
     */
    function createMarket(address token0Address, address token1Address,
        address payable fundsWalletAddress,
        uint256[5] memory uint256Values) external override onlyOwner {
        // input validations
        require(token0Address.isContract(), "{createMarket} : token0Address is not contract");
        require(token1Address.isContract(), "{createMarket} : token1Address is not contract");
        require(fundsWalletAddress != address(0), "{createMarket} : invalid fundsWalletAddress");
        // solhint-disable-next-line not-rely-on-time
        require(uint256Values[0] >= block.timestamp, "{createMarket} : eventStartTimestamp should be in the future");
        require(uint256Values[1] > uint256Values[0],
            "{createMarket} : eventStartTimestamp should be less than eventEndTimestamp");
        require(uint256Values[2] > 0, "{createMarket} : individualCap cannot be zero");
        require(uint256Values[3] > 0, "{createMarket} : totalCap cannot be zero");
        require(uint256Values[2] <= uint256Values[3], "{createMarket} : individualCap cannot exceed totalCap");
        require(uint256Values[4] > 0, "{createMarket} : token0PerToken1 cannot be zero");
        require(app.mode == AppMode.VAULT_LOCKED, "{createMarket} : app mode is not VAULT_LOCKED");
        app.mode = AppMode.MARKET_CREATED;
        app.marketStatus = MarketStatus.OPEN;
        // set values
        app.token0 = IToken0(token0Address);
        app.token1 = IERC20(token1Address);
        app.fundsWallet = fundsWalletAddress;
        app.marketStart = uint256Values[0];
        app.marketEnd = uint256Values[1];
        app.individualCap = uint256Values[2];
        app.totalCap = uint256Values[3];
        app.token0PerToken1 = uint256Values[4];
    }

    /**
    * @notice Allows changing the individual cap.
    */
    function changeIndividualCap(uint256 individualCapAmount) external override onlyOwner {
        require(app.mode == AppMode.MARKET_CREATED, "{changeIndividualCap} : app mode is not MARKET_CREATED");
        require(individualCapAmount > 0, "{changeIndividualCap} : individualCapAmount cannot be zero");
        require(individualCapAmount < app.totalCap,
            "{changeIndividualCap} : individualCapAmount cannot exceed total cap");
        app.individualCap = individualCapAmount;
    }

    /**
    * @dev Allows owner to lock payments and activate token0 issuance.
    */
    function closeMarket() external override onlyOwner {
        require(app.mode == AppMode.MARKET_CREATED, "{closeMarket} : app mode is not MARKET_CREATED");
        // ensure event has ended
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > app.marketEnd, "Cannot enable issuance while event is still active");
        // ensure smart contract has sufficient token0 tokens to issue
        require(app.token0.balanceOf(address(this)) >= app.token0PerToken1.mul(app.totaltoken1Paid),
            "Insufficient token0 balance");
        // enable token0Issuance
        app.marketStatus = MarketStatus.CLOSED;
    }

    function withdrawToken1() external override onlyOwner {
        require(app.mode == AppMode.MARKET_CREATED, "{withdrawToken1} : app mode is not MARKET_CREATED");
        // payments should be locked
        require(app.marketStatus == MarketStatus.CLOSED, "{withdrawToken1} : marketStatus is not CLOSED");
        require(!app.token1Withdrawn, "{withdrawToken1} : already withdrawn");
        app.token1Withdrawn = true;
        app.token1.safeTransfer(msg.sender, app.totaltoken1Paid);
        // emit notification
        emit Token1Withdrawn(msg.sender, app.totaltoken1Paid);
    }

    /**
    * @notice Records contribution per account.
    */
    function pay(uint256 token1Amount) external override whileIsActive {
        require(app.mode == AppMode.MARKET_CREATED, "{pay} : app mode is not MARKET_CREATED");
        // validations
        require(msg.sender != address(0), "{pay} : invalid payer address");
        require(token1Amount > 0, "{pay} : token1Amount cannot be zero");
        require(app.totaltoken1Paid.add(token1Amount) <= app.totalCap, "{pay} : token1Amount cannot exceed totalCap");
        require(app.payments[msg.sender].token1Amount.add(token1Amount) <= app.individualCap,
            "{pay} : token1Amount cannot exceed individualCap");
        // if we have not received any WEI from this address until now, then we add this address to buyers list.
        if (app.payments[msg.sender].token1Amount == 0) {
            app.buyers.push(msg.sender);
        }
        app.payments[msg.sender].token1Amount = app.payments[msg.sender].token1Amount.add(token1Amount);
        app.totaltoken1Paid = app.totaltoken1Paid.add(token1Amount);
        app.token1.safeTransferFrom(msg.sender, address(this), token1Amount);
        // emit notification
        emit PaymentReceived(msg.sender, token1Amount);
    }

    /**
    * @notice Issues token0 to the contributor
    */
    function withdrawToken0() external override {
        require(app.mode == AppMode.MARKET_CREATED, "{withdrawToken0} : app mode is not MARKET_CREATED");
        // payments should be locked
        require(app.marketStatus == MarketStatus.CLOSED, "Payments can no longer be made");
        require(app.payments[msg.sender].token1Amount > 0, "Payment amount is zero");
        require(!app.payments[msg.sender].token0Withdrawn, "Contributor has withdrawn token0s");
        app.payments[msg.sender].token0Withdrawn = true;
        uint256 token0Amount = app.token0PerToken1.mul(app.payments[msg.sender].token1Amount);
        app.token0.safeTransfer(msg.sender, token0Amount);
        // emit notification
        emit Token0Withdrawn(msg.sender, token0Amount);
    }

    function token0() external view override returns (address) {
        return address(app.token0);
    }

    function token1() external view override returns (address) {
        return address(app.token1);
    }

    function fundsWallet() external view override returns (address) {
        return app.fundsWallet;
    }

    function marketStart() external view override returns (uint256) {
        return app.marketStart;
    }

    function marketEnd() external view override returns (uint256) {
        return app.marketEnd;
    }

    function individualCap() external view override returns (uint256) {
        return app.individualCap;
    }

    function totalCap() external view override returns (uint256) {
        return app.totalCap;
    }

    function token0PerToken1() external view override returns (uint256) {
        return app.token0PerToken1;
    }

    function marketClosed() external view override returns (bool) {
        return app.marketStatus == MarketStatus.CLOSED;
    }

    function totaltoken1Paid() external view override returns (uint256) {
        return app.totaltoken1Paid;
    }

    function buyers(uint256 arrayIndex) external view override returns (address) {
        return app.buyers[arrayIndex];
    }

    function payments(address contributorAddress) external view override returns (uint256 token1Amount,
        bool token0Withdrawn) {
        token1Amount = app.payments[contributorAddress].token1Amount;
        token0Withdrawn = app.payments[contributorAddress].token0Withdrawn;
    }

    /**
    * @notice Displays number of conttibutors
    */
    function totalBuyers() external view override returns (uint256) {
        return app.buyers.length;
    }
}
