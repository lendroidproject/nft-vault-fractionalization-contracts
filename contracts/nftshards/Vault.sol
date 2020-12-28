// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/Address.sol";


/** @title Vault
    @author Lendroid Foundation
    @notice Smart contract representing a NFT shard event
    @dev Audit certificate : Pending
*/

// solhint-disable-next-line indent
abstract contract Vault is Ownable, ERC721Holder {
    using SafeMath for uint256;
    using Address for address;

    /**
    * @notice Allows owner to add NFTs to the vault.
    * Eg, [0x67678.., 0x2178..., 0x67678], [3, 1321, 33], ["kitty", "land", "kitty"]
    */
    function add(address[] tokenAddresses, uint256[] tokenIds, atring[] memory categories) external override onlyOwner {
        require(individualCapWeiAmount > 0, "Individual cap cannot be zero");
        require(individualCapWeiAmount < totalCapInWei, "Individual cap cannot exceed total cap");
        individualCapInWei = individualCapWeiAmount;
    }

}
