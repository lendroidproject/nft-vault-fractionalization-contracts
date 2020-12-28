// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


/**
 * @dev Required interface of a Festival compliant contract.
 */
interface IFestival {
    // admin
    function changeIndividualCapInWei(uint256 individualCapWeiAmount) external;
    function reclaimEther(address payable beneficiary) external;
    function activateIssuance() external;
    // end user
    function contributeWei() external payable;
    function claimShards() external;
}
