// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IMarket.sol";
import "./interfaces/IToken0.sol";


/** @title Market
    @author Lendroid Foundation
    @notice Smart contract representing token0 market
    @dev Audit certificate : Pending
*/
contract Market is IMarket, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using Address for address;

    enum AppMode { VAULT_LOCKED, MARKET_CREATED }

    enum MarketStatus { OPEN, CLOSED }

    struct Payment {
        uint256 token1Amount;
        bool token0Withdrawn;
    }

    struct BidDeposit {
        uint256 token0Amount;
        uint256 token2Amount;
    }

    struct PendingBidWithdrawal {
        uint256 token0Amount;
        uint256 token2Amount;
    }

    AppMode public mode;
    MarketStatus public marketStatus;
    IToken0 public token0;
    // admin
    IERC20 public token1;
    uint256 public marketStart;
    uint256 public marketEnd;
    address public fundsWallet;// address where funds are collected
    uint256 public totalCap;// total payment cap
    uint256 public individualCap;// individual payment cap
    uint256 public totaltoken1Paid;
    bool public token1Withdrawn;
    uint256 public token0PerToken1;// token0 distributed per token1 paid
    //// end user
    address[] public buyers;
    mapping (address => Payment) public payments;

    event PaymentReceived(address buyer, uint256 amount);

    event Token0Withdrawn(address beneficiary, uint256 amount);

    event Token1Withdrawn(address beneficiary, uint256 amount);

    modifier whileIsActive() {
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= marketStart && block.timestamp <= marketEnd,
            "{Market} : market is not active");
        _;
    }

    function createMarket(address token0Address, address token1Address,
        address fundsWalletAddress,
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
        require(mode == AppMode.VAULT_LOCKED, "{createMarket} : app mode is not VAULT_LOCKED");
        mode = AppMode.MARKET_CREATED;
        marketStatus = MarketStatus.OPEN;
        // set values
        token0 = IToken0(token0Address);
        token1 = IERC20(token1Address);
        fundsWallet = fundsWalletAddress;
        marketStart = uint256Values[0];
        marketEnd = uint256Values[1];
        individualCap = uint256Values[2];
        totalCap = uint256Values[3];
        token0PerToken1 = uint256Values[4];
    }

    /**
    * @notice Allows changing the individual cap.
    */
    function changeIndividualCap(uint256 individualCapAmount) external override onlyOwner {
        require(mode == AppMode.MARKET_CREATED, "{changeIndividualCap} : app mode is not MARKET_CREATED");
        require(individualCapAmount > 0, "{changeIndividualCap} : individualCapAmount cannot be zero");
        require(individualCapAmount < totalCap,
            "{changeIndividualCap} : individualCapAmount cannot exceed total cap");
        individualCap = individualCapAmount;
    }

    /**
    * @dev Allows owner to lock payments and activate token0 issuance.
    */
    function closeMarket() external override onlyOwner {
        require(mode == AppMode.MARKET_CREATED, "{closeMarket} : app mode is not MARKET_CREATED");
        // ensure event has ended
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > marketEnd, "Cannot enable issuance while event is still active");
        uint256 token0Amount = token0PerToken1.mul(totaltoken1Paid);
        // transfer token0Amount
        token0.safeTransferFrom(msg.sender, address(this), token0Amount);
        // enable token0Issuance
        marketStatus = MarketStatus.CLOSED;
    }

    function withdrawToken1() external override onlyOwner {
        require(mode == AppMode.MARKET_CREATED, "{withdrawToken1} : app mode is not MARKET_CREATED");
        // payments should be locked
        require(marketStatus == MarketStatus.CLOSED, "{withdrawToken1} : marketStatus is not CLOSED");
        require(!token1Withdrawn, "{withdrawToken1} : already withdrawn");
        token1Withdrawn = true;
        token1.safeTransfer(address(fundsWallet), totaltoken1Paid);
        // emit notification
        emit Token1Withdrawn(msg.sender, totaltoken1Paid);
    }

    /**
    * @notice Records contribution per account.
    */
    function pay(uint256 token1Amount) external override whileIsActive {
        require(mode == AppMode.MARKET_CREATED, "{pay} : app mode is not MARKET_CREATED");
        // validations
        require(msg.sender != address(0), "{pay} : invalid payer address");
        require(token1Amount > 0, "{pay} : token1Amount cannot be zero");
        require(totaltoken1Paid.add(token1Amount) <= totalCap, "{pay} : token1Amount cannot exceed totalCap");
        require(payments[msg.sender].token1Amount.add(token1Amount) <= individualCap,
            "{pay} : token1Amount cannot exceed individualCap");
        // if we have not received any WEI from this address until now, then we add this address to buyers list.
        if (payments[msg.sender].token1Amount == 0) {
            buyers.push(msg.sender);
        }
        payments[msg.sender].token1Amount = payments[msg.sender].token1Amount.add(token1Amount);
        totaltoken1Paid = totaltoken1Paid.add(token1Amount);
        token1.safeTransferFrom(msg.sender, address(this), token1Amount);
        token1.transfer(address(fundsWallet), token1Amount);
        // emit notification
        emit PaymentReceived(msg.sender, token1Amount);
    }

    /**
    * @notice Issues token0 to the contributor
    */
    function withdrawToken0() external override {
        require(mode == AppMode.MARKET_CREATED &&
                marketStatus == MarketStatus.CLOSED,
                "{withdrawToken0} : app mode is not MARKET_CREATED__CLOSED");
        // payments should be locked
        require(payments[msg.sender].token1Amount > 0, "{withdrawToken0} : payment amount is zero");
        require(!payments[msg.sender].token0Withdrawn, "{withdrawToken0} : withdrawal already made");
        payments[msg.sender].token0Withdrawn = true;
        uint256 token0Amount = token0PerToken1.mul(payments[msg.sender].token1Amount);
        token0.safeTransfer(msg.sender, token0Amount);
        // emit notification
        emit Token0Withdrawn(msg.sender, token0Amount);
    }

    function marketClosed() external view override returns (bool) {
        return marketStatus == MarketStatus.CLOSED;
    }

    function totalBuyers() external view override returns (uint256) {
        return buyers.length;
    }
}
