// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "./libraries/LibAppStorage.sol";
import "./libraries/LibDiamond.sol";
import "./facets/OwnershipFacet.sol";
import "./facets/DiamondCutFacet.sol";
import "./facets/DiamondLoupeFacet.sol";
import "@openzeppelin/contracts/introspection/IERC165.sol";
import "./interfaces/IDiamondCut.sol";
import "./interfaces/IDiamondLoupe.sol";


contract AppDiamond {
    using LibAppStorage for AppStorage;
    AppStorage internal s;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    struct ConstructorArgs {
        address contractOwner;
        address treasury;
    }

    // solhint-disable-next-line func-visibility
    constructor(IDiamondCut.FacetCut[] memory _diamondCut, ConstructorArgs memory _args) {
        LibDiamond.diamondCut(_diamondCut, address(0), new bytes(0));
        LibDiamond.setContractOwner(_args.contractOwner);
        s.treasury = _args.treasury;

        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // adding ERC165 data
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;// solhint-disable-line indent
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;// solhint-disable-line indent
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;// solhint-disable-line indent
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;// solhint-disable-line indent
    }

    /* solhint-disable */
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        address facet = address(bytes20(ds.facets[msg.sig]));
        require(facet != address(0), "Diamond: Function does not exist");
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
                case 0 {
                    revert(0, returndatasize())
                }
                default {
                    return(0, returndatasize())
                }
        }
    }

    receive() external payable {}
    /* solhint-enable */
}
