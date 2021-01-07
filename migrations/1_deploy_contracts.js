/* eslint-disable prefer-const */
const Diamond = artifacts.require("FestivalDiamond");
const DiamondCutFacet = artifacts.require("DiamondCutFacet");
const DiamondLoupeFacet = artifacts.require("DiamondLoupeFacet");
const OwnershipFacet = artifacts.require("OwnershipFacet");

const VaultFacet = artifacts.require("VaultFacet");

const FestivalFacet = artifacts.require("FestivalFacet");
const FestivalToken = artifacts.require("MockFestivalToken");
const SimpleWallet = artifacts.require("MockSimpleWallet");
const SimpleTreasury = artifacts.require("MockSimpleTreasury");

const FacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2
};

function getSelectors (contract) {
    const selectors = contract.abi.reduce((acc, val) => {
        if (val.type === "function") {
            acc.push(val.signature);
            return acc;
        } else {
            return acc;
        }
    }, []);
    return selectors;
}

module.exports = function (deployer, network, accounts) {
    deployer.deploy(VaultFacet);

    deployer.deploy(FestivalFacet);
    deployer.deploy(FestivalToken);
    deployer.deploy(SimpleWallet);
    deployer.deploy(SimpleTreasury);

    deployer.deploy(DiamondCutFacet);
    deployer.deploy(DiamondLoupeFacet);
    deployer.deploy(OwnershipFacet).then(() => {
        const diamondCut = [
            [DiamondCutFacet.address, FacetCutAction.Add, getSelectors(DiamondCutFacet)],
            [DiamondLoupeFacet.address, FacetCutAction.Add, getSelectors(DiamondLoupeFacet)],
            [OwnershipFacet.address, FacetCutAction.Add, getSelectors(OwnershipFacet)],
            [FestivalFacet.address, FacetCutAction.Add, getSelectors(FestivalFacet)],
            [VaultFacet.address, FacetCutAction.Add, getSelectors(VaultFacet)]
        ];
        return deployer.deploy(Diamond, diamondCut, [accounts[0], SimpleTreasury.address]);
    });
};
