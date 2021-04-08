// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "./IToken0.sol";


/** @title Token0
    @author Lendroid Foundation
    @notice Smart contract representing the Shard token of an NFT Vault
    @dev Audit certificate : Pending
*/
contract Token0 is IToken0, ERC20Capped, ERC20Burnable, Ownable {

    // solhint-disable-next-line func-visibility
    constructor (uint256 cap, string memory name, string memory symbol) ERC20(name, symbol)
        ERC20Capped(cap) {}// solhint-disable-line no-empty-blocks

    function mint(address account, uint256 amount) external override onlyOwner {
        _mint(account, amount);
    }

    function burn(uint256 amount) public override(ERC20Burnable, IToken0) onlyOwner {
        super.burn(amount);
    }

    function burnFrom(address account, uint256 amount) public override(ERC20Burnable, IToken0) onlyOwner {
        super.burnFrom(account, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override(
            ERC20, ERC20Capped) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
