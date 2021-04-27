// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "./MockMintableERC721.sol";


contract MockNFTB20 is MockMintableERC721 {
    // solhint-disable-next-line func-visibility
    constructor () MockMintableERC721("Test NFT B20", "TNFTB20") {}// solhint-disable-line no-empty-blocks
}
