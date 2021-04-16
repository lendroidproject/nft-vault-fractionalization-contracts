// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IToken0.sol";


/** @title SimpleMarket
    @author Lendroid Foundation
    @notice Smart contract representing token0 market
    @dev Audit certificate : Pending
*/
contract SimpleMarket2 is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using Address for address;

    enum MarketStatus { CREATED, OPEN, CLOSED }

    MarketStatus public marketStatus;
    IToken0 public token0;
    // admin
    IERC20 public token1;
    uint256 public marketStart;
    address public fundsWallet;// address where funds are collected
    uint256 public totalCap;// total payment cap
    uint256 public individualCap;// individual payment cap
    uint256 public totaltoken1Paid;
    uint256 public token1PerToken0;// token0 distributed per token1 paid
    //// end user
    address[] public buyers;
    mapping (address => uint256) public payments;

    event PaymentReceived(address buyer, uint256 amount);

    function createMarket(address token0Address, address token1Address,
        address fundsWalletAddress,
        uint256[4] memory uint256Values) external onlyOwner {
        require(marketStatus == MarketStatus.CREATED, "{createMarket} : market has already been created");
        // input validations
        require(token0Address.isContract(), "{createMarket} : token0Address is not contract");
        require(token1Address.isContract(), "{createMarket} : token1Address is not contract");
        require(fundsWalletAddress != address(0), "{createMarket} : invalid fundsWalletAddress");
        // solhint-disable-next-line not-rely-on-time
        require(uint256Values[0] >= block.timestamp, "{createMarket} : marketStart should be in the future");
        require(uint256Values[1] > 0, "{createMarket} : totalCap cannot be zero");
        require(uint256Values[2] > 0, "{createMarket} : token1PerToken0 cannot be zero");
        require(uint256Values[3] > 0, "{createMarket} : individualCap cannot be zero");
        marketStatus = MarketStatus.OPEN;
        // set values
        token0 = IToken0(token0Address);
        token1 = IERC20(token1Address);
        fundsWallet = fundsWalletAddress;
        marketStart = uint256Values[0];
        totalCap = uint256Values[1];
        require(token0.balanceOf(address(this)) >= totalCap, "{createMarket}: insufficient token0 balance to meet totalCap");
        token1PerToken0 = uint256Values[2];
        individualCap = uint256Values[3];
    }

    /**
    * @dev Allows owner to close the market and activate token0 issuance.
    */
    function closeMarket() external onlyOwner {
        require(marketStatus == MarketStatus.OPEN, "{closeMarket} : marketStatus is not OPEN");
        // close market
        marketStatus = MarketStatus.CLOSED;
        // retrieve token0 remaining to owner
        uint256 token0Remaining = token0.balanceOf(owner());
        if (token0Remaining > 0) {
            token0.safeTransfer(owner(), token0Remaining);
        }
    }

    /**
    * @notice Records payment per account.
    */
    function pay(uint256 token1Amount) external {
        require(marketStatus == MarketStatus.OPEN, "{pay} : marketStatus is not OPEN");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= marketStart, "{pay} : market has not yet started");
        // validations
        require(token1Amount > 0, "{pay} : token1Amount cannot be zero");
        require(totaltoken1Paid.add(token1Amount) <= totalCap, "{pay} : token1Amount cannot exceed totalCap");
        require(payments[msg.sender].add(token1Amount) <= individualCap,
            "{pay} : token1Amount cannot exceed individualCap");
        // if we have not received any WEI from this address until now, then we add this address to buyers list.
        if (payments[msg.sender] == 0) {
            buyers.push(msg.sender);
        }
        payments[msg.sender] = payments[msg.sender].add(token1Amount);
        totaltoken1Paid = totaltoken1Paid.add(token1Amount);
        // send token1 from sender to fundsWallet
        token1.safeTransferFrom(msg.sender, address(fundsWallet), token1Amount);
        // send token0 to sender
        uint256 token0Amount = token1Amount.mul(1e18).div(token1PerToken0);
        token0.safeTransfer(msg.sender, token0Amount);
        // emit notification
        emit PaymentReceived(msg.sender, token1Amount);
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
