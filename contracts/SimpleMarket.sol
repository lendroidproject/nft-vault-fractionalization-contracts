// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IToken0.sol";


/** @title Market
    @author Lendroid Foundation
    @notice Smart contract representing token0 market
    @dev Audit certificate : Pending
*/
contract Market is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using Address for address;

    enum MarketStatus { OPEN, CLOSED }

    struct Payment {
        uint256 token1Amount;
        bool token0Withdrawn;
    }

    MarketStatus public marketStatus;
    IToken0 public token0;
    // admin
    IERC20 public token1;
    uint256 public marketStart;
    address public fundsWallet;// address where funds are collected
    uint256 public totalCap;// total payment cap
    uint256 public totaltoken1Paid;
    bool public token1Withdrawn;
    uint256 public token1PerToken0;// token0 distributed per token1 paid
    //// end user
    address[] public buyers;
    mapping (address => Payment) public payments;

    event PaymentReceived(address buyer, uint256 amount);

    event Token0Withdrawn(address beneficiary, uint256 amount);

    event Token1Withdrawn(address beneficiary, uint256 amount);

    function createMarket(address token0Address, address token1Address,
        address fundsWalletAddress,
        uint256[3] memory uint256Values) external onlyOwner {
        // input validations
        require(token0Address.isContract(), "{createMarket} : token0Address is not contract");
        require(token1Address.isContract(), "{createMarket} : token1Address is not contract");
        require(fundsWalletAddress != address(0), "{createMarket} : invalid fundsWalletAddress");
        // solhint-disable-next-line not-rely-on-time
        require(uint256Values[0] >= block.timestamp, "{createMarket} : marketStart should be in the future");
        require(uint256Values[1] > 0, "{createMarket} : totalCap cannot be zero");
        require(uint256Values[2] > 0, "{createMarket} : token1PerToken0 cannot be zero");
        marketStatus = MarketStatus.OPEN;
        // set values
        token0 = IToken0(token0Address);
        token1 = IERC20(token1Address);
        fundsWallet = fundsWalletAddress;
        marketStart = uint256Values[0];
        totalCap = uint256Values[1];
        token1PerToken0 = uint256Values[2];
    }

    /**
    * @dev Allows owner to close the market and activate token0 issuance.
    */
    function closeMarket() external onlyOwner {
        require(marketStatus == MarketStatus.OPEN, "{closeMarket} : marketStatus is not OPEN");
        uint256 token0Amount = token1PerToken0.mul(totaltoken1Paid);
        // transfer token0Amount
        token0.safeTransferFrom(msg.sender, address(this), token0Amount);
        // enable token0Issuance
        marketStatus = MarketStatus.CLOSED;
    }

    /**
    * @notice Records payment per account.
    */
    function pay(uint256 token1Amount) external {
        require(marketStatus == MarketStatus.OPEN, "{pay} : closeMarket is not OPEN");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= marketStart, "{pay} : market has not yet started");
        // validations
        require(msg.sender != address(0), "{pay} : invalid payer address");
        require(token1Amount > 0, "{pay} : token1Amount cannot be zero");
        require(totaltoken1Paid.add(token1Amount) <= totalCap, "{pay} : token1Amount cannot exceed totalCap");
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
    function withdrawToken0() external {
        require(marketStatus == MarketStatus.CLOSED, "{withdrawToken0} : marketStatus is not CLOSED");
        // payments should be locked
        require(payments[msg.sender].token1Amount > 0, "{withdrawToken0} : payment amount is zero");
        require(!payments[msg.sender].token0Withdrawn, "{withdrawToken0} : withdrawal already made");
        payments[msg.sender].token0Withdrawn = true;
        uint256 token0Amount = payments[msg.sender].token1Amount.mul(1e18).div(token1PerToken0);
        token0.safeTransfer(msg.sender, token0Amount);
        // emit notification
        emit Token0Withdrawn(msg.sender, token0Amount);
    }

    function marketClosed() external view returns (bool) {
        return marketStatus == MarketStatus.CLOSED;
    }

    function marketOpen() external view returns (bool) {
        return marketStatus == MarketStatus.OPEN;
    }

    function totalBuyers() external view returns (uint256) {
        return buyers.length;
    }
}
