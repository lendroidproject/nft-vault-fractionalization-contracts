// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;


/**
 * @dev Required interface of a Token0Admin compliant contract.
 */
interface IToken0Admin {
    // admin
    function createToken(uint256 cap, string memory name, string memory symbol) external;

    function mintToken(address account, uint256 amount) external;
}
