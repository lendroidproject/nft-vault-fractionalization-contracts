// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IToken0.sol";
import "./SimpleMarketBase.sol";


/** @title SimpleMarket2
    @author Lendroid Foundation
    @notice Smart contract representing token0 market
    @dev Audit certificate : Pending
*/
contract SimpleMarket2 is SimpleMarketBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using Address for address;

    uint256 public individualCap;// individual payment cap

    mapping (address => bool) public whitelist;

    function createMarket(address token0Address, address token1Address,
        address fundsWalletAddress,
        uint256[4] memory uint256Values) external onlyOwner {
        require(uint256Values[3] > 0, "{createMarket} : individualCap cannot be zero");
        _createMarket(token0Address, token1Address, fundsWalletAddress,
            [uint256Values[0], uint256Values[1], uint256Values[2]]);
        individualCap = uint256Values[3];
    }

    /**
    * @notice Records payment per account.
    */
    function pay(uint256 token1Amount) external {
        require(whitelist[msg.sender], "{pay} : user is not whitelisted");
        require(marketStatus == MarketStatus.OPEN, "{pay} : marketStatus is not OPEN");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= marketStart, "{pay} : market has not yet started");
        // validations
        require(token1Amount > 0, "{pay} : token1Amount cannot be zero");
        require(totaltoken1Paid.add(token1Amount) <= totalCap, "{pay} : token1Amount cannot exceed totalCap");
        require(payments[msg.sender].add(token1Amount) <= individualCap,
            "{pay} : token1Amount cannot exceed individualCap");
        _pay(msg.sender, token1Amount);
    }

    function whitelistAddresses(address[] calldata addrs) external onlyOwner returns(bool) {
        require(addrs.length <= 100, "{whitelistAddresses} : invalid params");
        for (uint i = 0; i < addrs.length; i++) {
            require(addrs[i] != address(0), "{whitelistAddresses} : invalid params");
            whitelist[addrs[i]] = true;
        }
        return true;
    }
}
