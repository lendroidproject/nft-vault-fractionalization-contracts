// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IDecentralandLandRegistry.sol";
import "./IVault.sol";


/** @title SimpleVault
    @author Lendroid Foundation
    @notice Smart contract representing a NFT Vault
    @dev Audit certificate : Pending
*/
contract SimpleVault is IVault, Ownable, ERC721Holder {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Address for address;

    struct Asset {
        string category;
        address tokenAddress;
        uint256 tokenId;
    }

    bool public locked;
    Asset[] public assets;
    uint256 public totalAssets;
    // return value for safeTransferFrom function calls of older ERC721 versions
    bytes4 public constant ERC721_RECEIVED_OLD = 0xf0b9e5ba;

    function lockVault() external override onlyOwner {
        toggleLock(true);
    }

    function unlockVault() external override onlyOwner {
        toggleLock(false);
    }

    /**
    * @notice Allows owner to add NFTs to the vault.
    * Eg, [0x67678.., 0x2178..., 0x67678], [3, 1321, 33], ["kitty", "land", "kitty"]
    */
    function safeAddAsset(address[] calldata tokenAddresses, uint256[] calldata tokenIds,
            string[] calldata categories) external override onlyOwner {
        require(!locked, "{safeAddAsset} : locked");
        require(tokenAddresses.length > 0, "{safeAddAsset} : tokenAddresses cannot be empty");
        require(tokenAddresses.length == tokenIds.length,
            "{safeAddAsset} : tokenAddresses and tokenIds lengths are not equal");
        require(tokenAddresses.length == categories.length,
            "{safeAddAsset} : tokenAddresses and categories lengths are not equal");
        // validate inputs
        for (uint i = 0; i < tokenAddresses.length; i++) {
            require(tokenAddresses[i].isContract(), "{safeAddAsset} : invalid tokenAddress");
            require(IERC721(tokenAddresses[i]).ownerOf(tokenIds[i]) == owner(), "{safeAddAsset} : invalid tokenId");
        }
        for (uint i = 0; i < tokenAddresses.length; i++) {
            totalAssets = totalAssets.add(1);
            // transfer the NFT
            IERC721(tokenAddresses[i]).safeTransferFrom(msg.sender, address(this), tokenIds[i]);
            // save asset to array
            assets.push(Asset({
                category: categories[i],
                tokenAddress: tokenAddresses[i],
                tokenId: tokenIds[i]
            }));
        }
    }

    /**
    * @notice Allows owner to transfer NFTs from the vault.
    * Eg, [3, 200, 54]
    */
    function safeTransferAsset(uint256[] calldata assetIndices) external override onlyOwner {
        require(!locked, "{safeTransferAsset} : locked");
        require(assetIndices.length > 0, "{safeTransferAsset} : assetIndices cannot be empty");
        // validate inputs
        for (uint i = 0; i < assetIndices.length; i++) {
            require(assets.length > assetIndices[i], "{safeTransferAsset} : 400, Invalid assetIndex");
            require(assets[assetIndices[i]].tokenAddress != address(0),
                "{safeTransferAsset} : 404, asset does not exist");
        }
        for (uint i = 0; i < assetIndices.length; i++) {
            totalAssets = totalAssets.sub(1);
            // transfer asset to new owner
            IERC721(assets[assetIndices[i]].tokenAddress).safeTransferFrom(address(this),
                owner(), assets[assetIndices[i]].tokenId);
            // remove asset but preserve array length
            delete assets[assetIndices[i]];
        }
    }

    // admin functions in case something goes wrong
    function escapeHatchERC721(address tokenAddress, uint256 tokenId) external override onlyOwner {
        require(tokenAddress != address(0), "{escapeHatchERC721} : invalid tokenAddress");
        require(IERC721(tokenAddress).ownerOf(tokenId) == address(this), "{escapeHatchERC721} : invalid tokenId");
        IERC721(tokenAddress).safeTransferFrom(address(this), owner(), tokenId);
    }

    /**
    * @notice Safety function to handle accidental token transfer to the contract
    */
    function escapeHatchERC20(address tokenAddress) external onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }

    function setDecentralandOperator(address registryAddress, address operatorAddress,
        uint256 assetIndex) external override onlyOwner {
        require(registryAddress != address(0), "{setDecentralandOperator} : invalid registryAddress");
        require(operatorAddress != address(0), "{setDecentralandOperator} : invalid operatorAddress");
        require(assets.length > assetIndex, "{setDecentralandOperator} : 400, Invalid assetIndex");
        IDecentralandLandRegistry(registryAddress).setUpdateOperator(assets[assetIndex].tokenId, operatorAddress);
    }

    function totalAssetSlots() external view override returns (uint256) {
        return assets.length;
    }

    function vaultOwner() public view override returns (address) {
        return owner();
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public override(IVault, Ownable) onlyOwner {
        require(newOwner != address(0), "{transferOwnership} : invalid new owner");
        super.transferOwnership(newOwner);
    }

    function onERC721Received(address, uint256, bytes memory) public pure override returns (bytes4) {
        return ERC721_RECEIVED_OLD;
    }

    function toggleLock(bool value) internal {
        require(locked != value, "{toggleLock} : incorrect value");
        locked = value;
    }
}
