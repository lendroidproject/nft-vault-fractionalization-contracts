// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "@openzeppelin/contracts/utils/Address.sol";
import "./MockMintableERC721.sol";


interface IERC721ReceiverDeprecated {
    function onERC721Received(address, uint256, bytes memory) external returns (bytes4);
}


contract MockNFT3 is MockMintableERC721 {

    using Address for address;

    bytes4 private constant _ERC721_RECEIVED_DEPRECATED = 0xf0b9e5ba;

    // solhint-disable-next-line func-visibility
    constructor () MockMintableERC721("Test NFT 3", "TNFT3") {}// solhint-disable-line no-empty-blocks

    /* // solhint-disable-next-line no-unused-vars
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory _data) internal override {
        _transfer(from, to, tokenId);
        if (to.isContract()) {
            bytes memory returndata = to.functionCall(abi.encodeWithSelector(
                IERC721ReceiverDeprecated(to).onERC721Received.selector,
                _msgSender(),
                from,
                tokenId
            ), "ERC721: transfer to non ERC721Receiver implementer");
            bytes4 retval = abi.decode(returndata, (bytes4));
            require(retval == _ERC721_RECEIVED_DEPRECATED, "ERC721: transfer to non ERC721Receiver implementer");
        }
    } */
    // solhint-disable-next-line no-unused-vars
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory _data) internal override {
        _transfer(from, to, tokenId);
        if (to.isContract()) {
            bytes4 retval = IERC721ReceiverDeprecated(to).onERC721Received(from, tokenId, _data);
            require(retval == _ERC721_RECEIVED_DEPRECATED, "ERC721: transfer to non ERC721Receiver implementer");
        }
    }
}
