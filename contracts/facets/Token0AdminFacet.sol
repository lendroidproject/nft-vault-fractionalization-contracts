// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../libraries/LibAppStorage.sol";
import "../Token0.sol";
import "../interfaces/IToken0Admin.sol";


/** @title VaultFacet
    @author Lendroid Foundation
    @notice Smart contract representing a NFT Vault
    @dev Audit certificate : Pending
*/
contract Token0AdminFacet is LibAppStorageModifiers, IToken0Admin {
    using SafeERC20 for IToken0;

    function createToken(uint256 cap, string memory name, string memory symbol) external override onlyOwner {
        require(app.mode == AppMode.VAULT_LOCKED, "{createToken} : app mode is not VAULT_LOCKED");
        app.mode = AppMode.TOKEN0_CREATED;
        Token0 token0 = new Token0(cap, name, symbol);
        app.token0 = IToken0(address(token0));
    }

    function mintToken(address account, uint256 amount) external override onlyOwner {
        Token0(address(app.token0)).mint(account, amount);
    }

}
