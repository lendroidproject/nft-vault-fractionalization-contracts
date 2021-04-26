// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IDecentralandLandRegistry.sol";
import "./IVault.sol";


/** @title SimpleVault2
    @author Lendroid Foundation
    @notice Smart contract representing an NFT Vault which contains the NFT key to the B.20 vault
    @dev Audit certificate : None (deployed after the B.20 audit)
*/
contract SimpleVault2 is IVault, Ownable, ERC721Holder {
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
    // NFT address that would be the key to unlock the B.20 Vault
    IERC721 vaultKey;
    // return value for safeTransferFrom function calls of older ERC721 versions
    bytes4 public constant ERC721_RECEIVED_OLD = 0xf0b9e5ba;

    // solhint-disable-next-line func-visibility
    constructor(address vaultKeyAddress) {
        // input validations
        require(vaultKeyAddress.isContract(), "{enableBuyout} : invalid token0Address");
        // set values
        vaultKey = IERC721(vaultKeyAddress);
    }

    /**
     * @dev Throws if called by any account other than the vault key owner.
     */
    modifier onlyVaultKeyOwner() {
        require(vaultKey.ownerOf(1) == _msgSender(), "Ownable: caller is not the vault key owner");
        _;
    }

    function lockVault() external override onlyVaultKeyOwner {
        toggleLock(true);
    }

    function unlockVault() external override onlyVaultKeyOwner {
        toggleLock(false);
    }

    /**
    * @notice Allows owner to add NFTs to the vault.
    * Eg, [0x67678.., 0x2178..., 0x67678], [3, 1321, 33], ["kitty", "land", "kitty"]
    */
    function safeAddAsset(address[] calldata tokenAddresses, uint256[] calldata tokenIds,
            string[] calldata categories) external override onlyVaultKeyOwner {
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
    function safeTransferAsset(uint256[] calldata assetIds) external override onlyVaultKeyOwner {
        require(!locked, "{safeTransferAsset} : locked");
        require(assetIds.length > 0, "{safeTransferAsset} : assetIds cannot be empty");
        // validate inputs
        for (uint i = 0; i < assetIds.length; i++) {
            require(assets.length > assetIds[i], "{safeTransferAsset} : 400, Invalid assetId");
            require(assets[assetIds[i]].tokenAddress != address(0),
                "{safeTransferAsset} : 404, asset does not exist");
        }
        for (uint i = 0; i < assetIds.length; i++) {
            totalAssets = totalAssets.sub(1);
            // transfer asset to new owner
            IERC721(assets[assetIds[i]].tokenAddress).safeTransferFrom(address(this),
                owner(), assets[assetIds[i]].tokenId);
            // remove asset but preserve array length
            delete assets[assetIds[i]];
        }
    }

    // admin functions in case something goes wrong
    function escapeHatchERC721(address tokenAddress, uint256 tokenId) external override onlyVaultKeyOwner {
        require(tokenAddress != address(0), "{escapeHatchERC721} : invalid tokenAddress");
        require(IERC721(tokenAddress).ownerOf(tokenId) == address(this), "{escapeHatchERC721} : invalid tokenId");
        IERC721(tokenAddress).safeTransferFrom(address(this), owner(), tokenId);
    }

    function setDecentralandOperator(address registryAddress, address operatorAddress,
        uint256 assetId) external override onlyVaultKeyOwner {
        require(registryAddress != address(0), "{setDecentralandOperator} : invalid registryAddress");
        require(operatorAddress != address(0), "{setDecentralandOperator} : invalid operatorAddress");
        require(assets.length > assetId, "{setDecentralandOperator} : 400, Invalid assetId");
        IDecentralandLandRegistry(registryAddress).setUpdateOperator(assets[assetId].tokenId, operatorAddress);
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
    function transferOwnership(address newOwner) public override(IVault, Ownable) onlyVaultKeyOwner {
        require(newOwner != address(0), "{transferOwnership} : invalid new owner");
        super.transferOwnership(newOwner);
    }

    function onERC721Received(address, uint256, bytes memory) public pure override returns (bytes4) {
        return ERC721_RECEIVED_OLD;
    }

    function toggleLock(bool value) internal {
        require(locked == !value, "{toggleLock} : incorrect value");
        locked = value;
    }
}
