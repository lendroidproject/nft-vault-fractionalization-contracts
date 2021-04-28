// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IToken0.sol";
import "./SimpleMarketBase.sol";


/** @title SimpleMarket
    @author Lendroid Foundation
    @notice Smart contract representing token0 market
    @dev Audit certificate : Pending
*/
contract SimpleMarket is SimpleMarketBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using Address for address;

    function createMarket(address token0Address, address token1Address,
        address fundsWalletAddress,
        uint256[3] memory uint256Values) external onlyOwner {
        _createMarket(token0Address, token1Address, fundsWalletAddress, uint256Values);
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
        _pay(msg.sender, token1Amount);
    }
}
