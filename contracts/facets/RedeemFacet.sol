// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "../libraries/LibAppStorage.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../interfaces/IRedeem.sol";


/** @title RedeemFacet
    @author Lendroid Foundation
    @notice Smart contract representing a NFT bundle buyout
    @dev Audit certificate : Pending
*/
contract RedeemFacet is LibAppStorageModifiers, IRedeem {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Events that will be emitted on changes.
    event HighestBidIncreased(address bidder, uint256 amount);
    event RedeemEnabled();

    function enableRedeem() external override onlyOwner {
        require(app.mode == AppMode.BUYOUT_ENABLED &&
            app.buyoutStatus == BuyoutStatus.ENDED,
            "{enableRedeem} : app mode is not BUYOUT_ENABLED__ENDED");
        app.mode = AppMode.REDEEM_ENABLED;

        app.redeemToken2Amount = app.bidDeposits[app.highestBidder].token2Amount;

        emit RedeemEnabled();
    }

    function redeem(uint256 token0Amount) external override {
        require(app.mode == AppMode.REDEEM_ENABLED, "{redeem} : app mode is not REDEEM_ENABLED");
        require(app.token0.balanceOf(msg.sender) >= token0Amount);
        uint256 token2Amount = token2AmountRedeemable(token0Amount);
        require(token2Amount > 0, "{redeem} : token2Amount cannot be zero");
        require(app.token2.balanceOf(address(this)) >= token2Amount);
        app.redeemToken2Amount = app.redeemToken2Amount.sub(token2Amount);
        // burn token0Amount
        app.token0.burnFrom(msg.sender, token0Amount);
        // send token2Amount
        app.token2.safeTransfer(msg.sender, token2Amount);
    }

    function unlockVault(uint256[] calldata assetIds) external override {
        require(app.mode == AppMode.REDEEM_ENABLED, "{redeem} : app mode is not REDEEM_ENABLED");
        require(assetIds.length > 0, "{safeTransferAsset} : assetIds cannot be empty");
        // validate inputs
        for (uint i = 0; i < assetIds.length; i++) {
            require(app.assets.length > assetIds[i], "{safeTransferAsset} : 400, Invalid assetId");
            require(app.assets[assetIds[i]].tokenAddress != address(0),
                "{safeTransferAsset} : 404, asset does not exist");
        }
        for (uint i = 0; i < assetIds.length; i++) {
            app.totalAssets = app.totalAssets.sub(1);
            // transfer asset to new owner
            IERC721(app.assets[assetIds[i]].tokenAddress).safeTransferFrom(address(this),
                app.highestBidder, app.assets[assetIds[i]].tokenId);
            // remove asset but preserve array length
            delete app.assets[assetIds[i]];
        }
    }

    function redeemToken2Amount() external view override returns (uint256) {
        return app.redeemToken2Amount;
    }

    function token2AmountRedeemable(uint256 token0Amount) public view override returns (uint256) {
        return token0Amount.mul(app.redeemToken2Amount).div(app.token0.totalSupply());
    }

}
