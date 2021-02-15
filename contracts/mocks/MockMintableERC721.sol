// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


// solhint-disable-next-line
contract MockMintableERC721 is ERC721, Ownable {
    using SafeMath for uint256;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdTracker;

    constructor (string memory name, string memory symbol) ERC721(name,// solhint-disable-line func-visibility
        symbol) {}// solhint-disable-line no-empty-blocks

    /**
     * @notice Allows owner to mint a a token to a given address
     * dev Mints a new token to the given address, increments currentTokenId
     * @param to address of the future owner of the token
    */
    function mintTo(address to) public onlyOwner {
        _mintTo(to);
    }

    function _mintTo(address to) internal {
        uint256 newTokenId = _getNextTokenId();
        _mint(to, newTokenId);
        _incrementTokenId();
    }

    /**
     * @notice Displays the id of the next token that will be minted
     * @dev Calculates the next token ID based on value of _currentTokenId
     * @return uint256 : id of the next token
    */
    function _getNextTokenId() private view returns (uint256) {
        return _tokenIdTracker.current().add(1);
    }

    /**
     * @notice Increments the value of _currentTokenId
     * @dev Internal function that increases the value of _currentTokenId by 1
    */
    function _incrementTokenId() private {
        _tokenIdTracker.increment();
    }
}
