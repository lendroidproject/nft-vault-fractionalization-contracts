// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md

pragma solidity 0.7.5;


interface IDecentralandLandRegistry {
    // Authorize UpdateOperator
    function setUpdateOperator(uint256 assetId, address operator) external;
}
