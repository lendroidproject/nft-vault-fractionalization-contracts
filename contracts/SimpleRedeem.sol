// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

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

    enum RedeemStatus { CREATED, ENABLED }

    RedeemStatus public status;
    IToken0 public token0;
    //// admin
    IERC20 public token2;
    uint256 public redeemToken2Amount;

    function enableRedeem(address token0Address, address token2Address,
            uint256 token2Amount) external override {
        // validate status
        require(status == RedeemStatus.CREATED, "{enableRedeem} : redeem has already been enabled");
        // input validations
        require(token0Address.isContract(), "{enableRedeem} : invalid token0Address");
        require(token2Address.isContract(), "{enableRedeem} : invalid token2Address");
        require(token2Amount > 0, "{enableRedeem} : token2Amount cannot be zero");
        // set values
        status = RedeemStatus.ENABLED;
        token0 = IToken0(token0Address);
        token2 = IERC20(token2Address);
        redeemToken2Amount = token2Amount;
    }

    function redeem(uint256 token0Amount) external override {
        require(status == RedeemStatus.ENABLED, "{redeem} : redeem has not yet been enabled");
        require(token0.balanceOf(msg.sender) >= token0Amount, "{redeem} : insufficient token0 amount");
        require(token0Amount > 0, "{redeem} : token0 amount cannot be zero");
        uint256 token2Amount = token2AmountRedeemable(token0Amount);
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
