// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "@openzeppelin/contracts/access/Ownable.sol";


/** @title MockSimpleTreasury
    @author Lendroid Foundation
    @notice Smart contract that stores treasury ether and tokens
    @dev Audit certificate : Pending
*/
contract MockSimpleTreasury is Ownable {

    event ValueReceived(uint256 amount);

    // TODO : functions for ERC20, ERC721, and ERC1155 tokens
    /**
    * @dev Transfers all Ether held by the contract to the address specified by owner.
    */
    function reclaimEther(address payable beneficiary) external onlyOwner {
        beneficiary.transfer(address(this).balance);
    }

    /* solhint-disable */
    receive() external payable {
        emit ValueReceived(msg.value);
    }
    /* solhint-enable */
}
