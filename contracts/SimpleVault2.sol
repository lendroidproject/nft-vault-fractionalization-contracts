// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./SimpleVault.sol";


/** @title SimpleVault2
    @author Lendroid Foundation
    @notice Smart contract representing an NFT Vault which contains the NFT key to the B.20 vault
    @dev Audit certificate : Pending (deployed after the B.20 audit)
*/
contract SimpleVault2 is SimpleVault {

    using Address for address;

    // NFT address that would be the key to unlock the B.20 Vault
    IERC721 public vaultKey;

    // solhint-disable-next-line func-visibility
    constructor(address vaultKeyAddress) {
        // input validations
        require(vaultKeyAddress.isContract(), "{SimpleVault2} : invalid vaultKeyAddress");
        // set values
        vaultKey = IERC721(vaultKeyAddress);
    }

    /**
     * @dev Returns the address of the current owner of the vault key.
     */
    function owner() public view override returns (address) {
        return vaultKey.ownerOf(1);
    }

    /**
     * @dev Throws if called by any account other than the owner of the vault key.
     */
    modifier onlyOwner() override {
        require(vaultKey.ownerOf(1) == _msgSender(),
            "{SimpleVault2}: caller is not the owner of vault key");
        _;
    }

    /**
     * @dev Transfer of ownership is meaningless, since the vault key owner is the actual owner.
     */
    function transferOwnership(address newOwner) public override {
        require(newOwner != address(0), "{transferOwnership} : invalid new owner");
        revert();
    }

}
