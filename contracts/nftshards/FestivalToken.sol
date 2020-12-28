// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";


/** @title FestivalToken
    @author Lendroid Foundation
    @notice Smart contract representing a NFT shard festival
    @dev Audit certificate : Pending
*/

// solhint-disable-next-line indent
abstract contract FestivalToken is ERC20Capped, ERC20Burnable, ERC20Pausable {

    address public governor;// address of the shard governor

    /**
    * @notice Constructor function
    */
    // solhint-disable-next-line func-visibility
    constructor (uint256 cap, string memory name, string memory symbol) ERC20(name, symbol) ERC20Capped(cap) {
        governor = msg.sender;
    }

    function setGovernor(address governorAddress) external {
        require(msg.sender == governor, "Invalid governor");
        governor = governorAddress;
    }

    function mint(address account, uint256 amount) external {
        require(msg.sender == governor, "Invalid governor");
        _mint(account, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override(
            ERC20, ERC20Capped, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
