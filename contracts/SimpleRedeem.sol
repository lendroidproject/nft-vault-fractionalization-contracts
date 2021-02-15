// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IToken0.sol";
import "./IRedeem.sol";


/** @title SimpleRedeem
    @author Lendroid Foundation
    @notice Smart contract representing redemption of Token0 for Token2
    @dev Audit certificate : Pending
*/
contract SimpleRedeem is IRedeem {
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using SafeMath for uint256;
    using Address for address;

    bool public enabled;
    IToken0 public token0;
    //// admin
    IERC20 public token2;
    uint256 public redeemToken2Amount;

    function enableRedeem(address token0Address, address token2Address,
            uint256 token2Amount) external override {
        // validate status
        require(!enabled, "{enableRedeem} : redeem has already been enabled");
        // input validations
        require(token0Address.isContract(), "{enableBuyout} : invalid token0Address");
        require(token2Address.isContract(), "{enableBuyout} : invalid token2Address");
        // set values
        enabled = true;
        token0 = IToken0(token0Address);
        token2 = IERC20(token2Address);
        redeemToken2Amount = token2Amount;
    }

    function redeem(uint256 token0Amount) external override {
        require(token0.balanceOf(msg.sender) >= token0Amount);
        uint256 token2Amount = token2AmountRedeemable(token0Amount);
        require(token2Amount > 0, "{redeem} : token2Amount cannot be zero");
        require(token2.balanceOf(address(this)) >= token2Amount);
        redeemToken2Amount = redeemToken2Amount.sub(token2Amount);
        // burn token0Amount
        token0.burnFrom(msg.sender, token0Amount);
        // send token2Amount
        token2.safeTransfer(msg.sender, token2Amount);
    }

    function token2AmountRedeemable(uint256 token0Amount) public view override returns (uint256) {
        return token0Amount.mul(redeemToken2Amount).div(token0.totalSupply());
    }

}
